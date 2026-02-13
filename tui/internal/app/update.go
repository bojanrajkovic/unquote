package app

import (
	"fmt"
	"strings"
	"time"
	"unicode"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"

	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/ui"
)

// Init is called when the program starts
func (m Model) Init() tea.Cmd {
	return fetchPuzzleCmd(m.client)
}

// Update handles incoming messages
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
	}

	return m, nil
}

func (m Model) handleKeyMsg(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
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
		// No input when solved (just Esc to quit)
		return m, nil
	}

	return m, nil
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
		// Save solved state
		return m, saveSolvedSessionCmd(m.puzzle.ID, m.cells, m.elapsedAtPause)
	}
	m.state = StatePlaying
	m.statusMsg = "Not quite right. Keep trying!"
	return m, nil
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
