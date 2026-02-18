package app

import (
	"fmt"
	"strings"
	"time"
	"unicode"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	zone "github.com/lrstanley/bubblezone"

	"github.com/bojanrajkovic/unquote/tui/internal/config"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/ui"
)

// Init is called when the program starts
func (m Model) Init() tea.Cmd {
	return loadConfigCmd()
}

// Update handles incoming messages.
//
//nolint:gocyclo // Bubble Tea's Update is a central message dispatcher — each message type needs its own case.
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return m.handleKeyMsg(msg)

	case tea.MouseMsg:
		return m.handleMouseMsg(msg)

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.sizeReady = true
		return m, nil

	case puzzleFetchedMsg:
		return m.handlePuzzleFetched(msg)

	case solutionCheckedMsg:
		return m.handleSolutionChecked(msg)

	case errMsg:
		return m.handleError(msg)

	case tickMsg:
		// Only tick while playing - this triggers re-render for timer display
		if m.state == StatePlaying {
			return m, tickCmd()
		}
		return m, nil

	case sessionLoadedMsg:
		return m.handleSessionLoaded(msg)

	case configLoadedMsg:
		return m.handleConfigLoaded(msg)

	case playerRegisteredMsg:
		return m.handlePlayerRegistered(msg)

	case configSavedMsg:
		return m.handleConfigSaved()

	case sessionRecordedMsg:
		return m.handleSessionRecorded(msg)

	case reconciliationDoneMsg:
		return m, nil

	case statsFetchedMsg:
		return m.handleStatsFetched(msg)
	}

	// Forward unhandled messages to huh form during onboarding (e.g. focus,
	// cursor blink, and other internal messages returned by form.Init()).
	if m.state == StateOnboarding && m.form != nil {
		formModel, cmd := m.form.Update(msg)
		if f, ok := formModel.(*huh.Form); ok {
			m.form = f
		}
		return m, cmd
	}

	return m, nil
}

func (m Model) handleKeyMsg(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Stats screen intercepts Esc/b before the global quit handler
	if m.state == StateStats {
		switch msg.String() {
		case "esc", "b":
			if m.statsOnly {
				return m, tea.Quit
			}
			m.state = StateSolved
			return m, nil
		}
		return m, nil
	}

	// Global keybindings (always work)
	if msg.String() == "esc" {
		return m, tea.Quit
	}

	// If terminal is too small, don't process other keys
	if m.IsTooSmall() {
		return m, nil
	}

	// State-specific keybindings
	switch m.state {
	case StateLoading, StateChecking:
		// No input during loading or checking
		return m, nil

	case StateError:
		return m.handleErrorKeyMsg(msg)

	case StatePlaying:
		return m.handlePlayingKeyMsg(msg)

	case StateSolved:
		if msg.String() == "s" && m.claimCode != "" {
			m.state = StateLoading
			return m, fetchStatsCmd(m.client, m.claimCode)
		}
		return m, nil

	case StateOnboarding:
		return m.handleOnboardingKeyMsg(msg)

	case StateClaimCodeDisplay:
		// Any keypress proceeds to puzzle loading
		m.state = StateLoading
		m.form = nil
		if m.opts.Random {
			return m, fetchRandomPuzzleCmd(m.client)
		}
		return m, fetchPuzzleCmd(m.client)
	}

	return m, nil
}

func (m Model) handlePlayerRegistered(msg playerRegisteredMsg) (tea.Model, tea.Cmd) {
	m.claimCode = msg.claimCode
	m.state = StateClaimCodeDisplay
	return m, tea.Batch(
		saveConfigCmd(&config.Config{ClaimCode: msg.claimCode, StatsEnabled: true}),
		reconcileSessionsCmd(m.client, msg.claimCode),
	)
}

func (m Model) handleConfigSaved() (tea.Model, tea.Cmd) {
	// If we're in claim code display, wait for user keypress.
	// If we're still in onboarding (opt-out path), proceed to puzzle.
	if m.state == StateOnboarding {
		m.state = StateLoading
		if m.opts.Random {
			return m, fetchRandomPuzzleCmd(m.client)
		}
		return m, fetchPuzzleCmd(m.client)
	}
	return m, nil
}

// handleConfigLoaded processes the result of loading the config from disk.
// If config exists (AC2.4), skip onboarding and proceed to puzzle loading.
// If config is nil (AC2.1), show onboarding form.
func (m Model) handleConfigLoaded(msg configLoadedMsg) (tea.Model, tea.Cmd) {
	if msg.config != nil {
		// Config exists — skip onboarding
		m.cfg = msg.config
		m.claimCode = msg.config.ClaimCode
		m.state = StateLoading

		// StatsMode: fetch stats instead of puzzle
		if m.opts.StatsMode {
			if m.claimCode == "" {
				m.state = StateError
				m.errorMsg = "No claim code found. Run 'unquote register' first."
				return m, nil
			}
			return m, fetchStatsCmd(m.client, m.claimCode)
		}

		var fetchCmd tea.Cmd
		if m.opts.Random {
			fetchCmd = fetchRandomPuzzleCmd(m.client)
		} else {
			fetchCmd = fetchPuzzleCmd(m.client)
		}

		cmds := []tea.Cmd{fetchCmd}
		if m.claimCode != "" {
			cmds = append(cmds, reconcileSessionsCmd(m.client, m.claimCode))
		}
		return m, tea.Batch(cmds...)
	}

	// No config — show onboarding form (AC2.1)
	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewNote().
				Title("Track Your Stats?").
				Description("Unquote can track your solve times and streaks.\n\n"+
					"What we store:\n"+
					"  - Which puzzles you solved\n"+
					"  - How long each took\n\n"+
					"What we don't store:\n"+
					"  - No personal information\n"+
					"  - No email, no password\n\n"+
					"You'll get a random claim code (like TIGER-MAPLE-7492)\n"+
					"that identifies your stats. Save it to access your\n"+
					"stats from another device."),
			huh.NewConfirm().
				Title("Track my stats?").
				Affirmative("Yes, track my stats").
				Negative("No thanks").
				Value(&m.optIn),
		),
	).WithShowHelp(false).WithShowErrors(false)
	m.state = StateOnboarding
	return m, m.form.Init()
}

// handleOnboardingKeyMsg delegates key events to the huh form.
// When the form completes, it handles opt-in or opt-out.
func (m Model) handleOnboardingKeyMsg(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	formModel, cmd := m.form.Update(msg)
	if f, ok := formModel.(*huh.Form); ok {
		m.form = f
	}

	if m.form.State == huh.StateCompleted {
		if m.optIn {
			// AC2.2: opt-in — save partial config and register player
			cfg := &config.Config{StatsEnabled: true}
			m.cfg = cfg
			return m, m.handleOptIn(cfg)
		}
		// AC2.3: opt-out — save config and go to puzzle
		cfg := &config.Config{StatsEnabled: false}
		m.cfg = cfg
		return m, saveConfigCmd(cfg)
	}

	return m, cmd
}

// handleOptIn builds the combined command for opt-in: save config + register player.
// Extracted for testability.
func (m Model) handleOptIn(cfg *config.Config) tea.Cmd {
	return tea.Batch(saveConfigCmd(cfg), registerPlayerCmd(m.client))
}

func (m Model) handleMouseMsg(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	// Only handle left click release (the "click" action)
	if msg.Action != tea.MouseActionRelease || msg.Button != tea.MouseButtonLeft {
		return m, nil
	}

	// Only handle clicks in playing state
	if m.state != StatePlaying {
		return m, nil
	}

	// Ignore clicks if terminal too small
	if m.IsTooSmall() {
		return m, nil
	}

	// Check each cell's zone for click
	for _, cell := range m.cells {
		if cell.Kind != puzzle.CellLetter {
			continue
		}

		zoneID := fmt.Sprintf("cell-%d", cell.Index)
		if zone.Get(zoneID).InBounds(msg) {
			m.cursorPos = cell.Index
			return m, nil
		}
	}

	return m, nil
}

func (m Model) handleErrorKeyMsg(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if msg.String() == "r" {
		// Retry on error
		m.state = StateLoading
		m.errorMsg = ""
		if m.opts.Random {
			return m, fetchRandomPuzzleCmd(m.client)
		}
		return m, fetchPuzzleCmd(m.client)
	}
	return m, nil
}

func (m Model) handlePlayingKeyMsg(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c":
		// Clear all input
		puzzle.ClearAllInput(m.cells)
		m.cursorPos = puzzle.FirstLetterCell(m.cells)
		m.statusMsg = ""
		// Save session after clearing all
		return m, saveSessionCmd(m.puzzle.ID, m.cells, m.Elapsed())

	case "enter":
		// Submit solution if complete
		return m.handleSubmit()

	case "left":
		// Move cursor left to previous letter cell
		prevPos := puzzle.PrevLetterCell(m.cells, m.cursorPos)
		if prevPos >= 0 {
			m.cursorPos = prevPos
		}
		return m, nil

	case "right":
		// Move cursor right to next letter cell
		nextPos := puzzle.NextLetterCell(m.cells, m.cursorPos)
		if nextPos >= 0 {
			m.cursorPos = nextPos
		}
		return m, nil

	case "backspace":
		// Clear current cell (and all matching cipher letters) and move back
		if m.cursorPos >= 0 && m.cursorPos < len(m.cells) {
			puzzle.ClearInput(m.cells, m.cursorPos)
			prevPos := puzzle.PrevLetterCell(m.cells, m.cursorPos)
			if prevPos >= 0 {
				m.cursorPos = prevPos
			}
		}
		m.statusMsg = ""
		// Save session after clearing
		return m, saveSessionCmd(m.puzzle.ID, m.cells, m.Elapsed())

	default:
		// Check for letter input
		if msg.Type == tea.KeyRunes && len(msg.Runes) > 0 {
			r := msg.Runes[0]
			if unicode.IsLetter(r) {
				return m.handleLetterInput(unicode.ToUpper(r))
			}
		}
	}

	return m, nil
}

func (m Model) handleLetterInput(letter rune) (tea.Model, tea.Cmd) {
	if m.cursorPos < 0 || m.cursorPos >= len(m.cells) {
		return m, nil
	}

	// Set the input
	if puzzle.SetInput(m.cells, m.cursorPos, letter) {
		// Auto-advance to next unfilled letter cell
		nextPos := puzzle.NextUnfilledLetterCell(m.cells, m.cursorPos)
		if nextPos >= 0 {
			m.cursorPos = nextPos
		}
	}

	// Clear any status message when typing
	m.statusMsg = ""

	// Save session after input
	return m, saveSessionCmd(m.puzzle.ID, m.cells, m.Elapsed())
}

func (m Model) handleSubmit() (tea.Model, tea.Cmd) {
	// Check if puzzle is complete
	if !puzzle.IsComplete(m.cells) {
		m.statusMsg = "Fill in all letters first!"
		return m, nil
	}

	// Assemble solution and submit
	solution := puzzle.AssembleSolution(m.cells)
	m.state = StateChecking
	m.statusMsg = ""

	return m, checkSolutionCmd(m.client, m.puzzle.ID, solution)
}

func (m Model) handleSolutionChecked(msg solutionCheckedMsg) (tea.Model, tea.Cmd) {
	if msg.correct {
		m.state = StateSolved
		m.statusMsg = ""
		// Capture final elapsed time
		m.elapsedAtPause += time.Since(m.startTime)

		cmds := []tea.Cmd{saveSolvedSessionCmd(m.puzzle.ID, m.cells, m.elapsedAtPause)}

		if m.claimCode != "" {
			cmds = append(cmds, recordSessionCmd(m.client, m.claimCode, m.puzzle.ID, m.elapsedAtPause))
		}

		return m, tea.Batch(cmds...)
	}
	m.state = StatePlaying
	m.statusMsg = "Not quite right. Keep trying!"
	return m, nil
}

func (m Model) handleSessionRecorded(msg sessionRecordedMsg) (tea.Model, tea.Cmd) {
	// Mark session as uploaded in background — fire and forget
	return m, markSessionUploadedCmd(msg.gameID)
}

func (m Model) handlePuzzleFetched(msg puzzleFetchedMsg) (tea.Model, tea.Cmd) {
	// Sanitize API response fields to prevent terminal escape sequence injection
	msg.puzzle.Author = ui.SanitizeString(msg.puzzle.Author)
	msg.puzzle.EncryptedText = ui.SanitizeString(msg.puzzle.EncryptedText)
	for i := range msg.puzzle.Hints {
		msg.puzzle.Hints[i].CipherLetter = ui.SanitizeString(msg.puzzle.Hints[i].CipherLetter)
		msg.puzzle.Hints[i].PlainLetter = ui.SanitizeString(msg.puzzle.Hints[i].PlainLetter)
	}

	// Convert API hints to cipher->plain rune map for BuildCells
	var hints map[rune]rune
	if len(msg.puzzle.Hints) > 0 {
		hints = make(map[rune]rune, len(msg.puzzle.Hints))
		for _, h := range msg.puzzle.Hints {
			if len(h.CipherLetter) > 0 && len(h.PlainLetter) > 0 {
				hints[rune(h.CipherLetter[0])] = rune(h.PlainLetter[0])
			}
		}
	}

	m.puzzle = msg.puzzle
	m.cells = puzzle.BuildCells(msg.puzzle.EncryptedText, hints)
	m.cursorPos = puzzle.FirstLetterCell(m.cells)
	m.state = StatePlaying
	m.startTime = time.Now()
	m.elapsedAtPause = 0
	// Load any saved session for this puzzle
	return m, loadSessionCmd(msg.puzzle.ID)
}

func (m Model) handleSessionLoaded(msg sessionLoadedMsg) (tea.Model, tea.Cmd) {
	if msg.session == nil {
		// No saved session - start fresh timer
		return m, tickCmd()
	}

	// Restore inputs - iterate cells and apply saved inputs
	// This must happen for both solved and in-progress sessions
	for i := range m.cells {
		if m.cells[i].Kind != puzzle.CellLetter {
			continue
		}
		cipherChar := string(m.cells[i].Char)
		if input, ok := msg.session.Inputs[cipherChar]; ok && input != "" {
			// SetInput propagates to all cells with same cipher letter
			puzzle.SetInput(m.cells, i, rune(input[0]))
		}
	}

	// Check if already solved
	if msg.session.Solved {
		m.state = StateSolved
		m.elapsedAtPause = msg.session.CompletionTime
		m.statusMsg = ""
		return m, nil
	}

	// Restore timer state for in-progress sessions
	m.elapsedAtPause = msg.session.ElapsedTime
	m.startTime = time.Now()

	return m, tickCmd()
}

func (m Model) handleStatsFetched(msg statsFetchedMsg) (tea.Model, tea.Cmd) {
	m.stats = msg.stats
	m.statsOnly = m.opts.StatsMode
	m.state = StateStats
	return m, nil
}

func (m Model) handleError(msg errMsg) (tea.Model, tea.Cmd) {
	m.state = StateError
	m.errorMsg = formatErrorMessage(msg.err)
	return m, nil
}

// formatErrorMessage converts error to user-friendly message
func formatErrorMessage(err error) string {
	errStr := err.Error()

	// Check for connection refused
	if strings.Contains(errStr, "connection refused") {
		return "Cannot connect to server. Check that the API is running."
	}

	// Check for timeout
	if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline exceeded") {
		return "Request timed out. Press 'r' to retry."
	}

	// Check for HTTP status errors (from our client)
	if strings.Contains(errStr, "server returned") {
		return errStr + " Press 'r' to retry."
	}

	// Default: show original error
	return errStr
}
