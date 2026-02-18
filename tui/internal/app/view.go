package app

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/guptarohit/asciigraph"
	zone "github.com/lrstanley/bubblezone"

	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/ui"
)

// formatElapsed formats a duration as MM:SS
func formatElapsed(d time.Duration) string {
	minutes := int(d.Minutes())
	seconds := int(d.Seconds()) % 60
	return fmt.Sprintf("%02d:%02d", minutes, seconds)
}

// View renders the UI
func (m Model) View() string {
	// Check if we've received window size yet
	if !m.sizeReady {
		return "Initializing..."
	}

	// Check if terminal is too small
	if m.IsTooSmall() {
		return m.viewTooSmall()
	}

	switch m.state {
	case StateLoading:
		return m.viewLoading()
	case StateError:
		return m.viewError()
	case StatePlaying, StateChecking, StateSolved:
		return m.viewPlaying()
	case StateOnboarding:
		return m.viewOnboarding()
	case StateClaimCodeDisplay:
		return m.viewClaimCodeDisplay()
	case StateStats:
		return m.viewStats()
	default:
		return "Unknown state"
	}
}

func (m Model) viewTooSmall() string {
	style := ui.ErrorStyle.Padding(1, 2)

	msg := fmt.Sprintf(
		"Terminal too small!\n\nCurrent: %dx%d\nMinimum: %dx%d\n\nPlease resize your terminal.",
		m.width, m.height,
		MinTerminalWidth, MinTerminalHeight,
	)

	help := ui.HelpStyle.Render("\n[Esc] Quit")

	return lipgloss.JoinVertical(
		lipgloss.Left,
		style.Render(msg),
		help,
	)
}

func (m Model) viewLoading() string {
	header := m.renderHeader()
	msg := m.loadingMsg
	if msg == "" {
		msg = "Loading puzzle..."
	}
	content := ui.LoadingStyle.Render(msg)
	help := ui.HelpStyle.Render("[Esc] Quit")

	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		"",
		content,
		"",
		help,
	)
}

func (m Model) viewError() string {
	header := m.renderHeader()

	// Wrap error message to fit terminal width (leave margin for padding)
	maxWidth := max(m.width-4, 20)
	wrappedMsg := ui.WordWrapText(fmt.Sprintf("Error: %s", m.errorMsg), maxWidth)
	content := ui.ErrorStyle.Render(wrappedMsg)

	help := ui.HelpStyle.Render("[r] Retry  [Esc] Quit")

	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		"",
		content,
		"",
		help,
	)
}

func (m Model) viewPlaying() string {
	header := m.renderHeader()

	// Category and Difficulty
	diffText := puzzle.DifficultyText(m.puzzle.Difficulty)
	difficulty := ui.DifficultyStyle.Render(fmt.Sprintf("%s · Difficulty: %s", m.puzzle.Category, diffText))

	// Timer
	timer := ui.TimerStyle.Render(fmt.Sprintf("Time: %s", formatElapsed(m.Elapsed())))

	// Hints
	hints := m.renderHints()

	// Puzzle grid
	grid := m.renderGrid()

	// Author
	author := ui.AuthorStyle.Render(fmt.Sprintf("— %s", m.puzzle.Author))

	// Status message (incorrect answer, incomplete, etc.)
	status := m.renderStatus()

	// Help bar based on state
	help := m.renderHelp()

	view := lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		difficulty,
		timer,
		"",
		hints,
		"",
		grid,
		"",
		author,
		"",
		status,
		help,
	)

	// Scan to process zone markers and calculate boundaries
	return zone.Scan(view)
}

func (m Model) renderHeader() string {
	headerStyle := ui.HeaderStyle
	if m.width > 0 {
		headerStyle = headerStyle.Width(m.width)
	}
	return headerStyle.Render("CRYPTO-QUIP")
}

func (m Model) renderHints() string {
	if m.puzzle == nil || len(m.puzzle.Hints) == 0 {
		return ""
	}

	var builder strings.Builder
	for i, hint := range m.puzzle.Hints {
		if i > 0 {
			builder.WriteString(", ")
		}
		builder.WriteString(hint.CipherLetter)
		builder.WriteString(" = ")
		builder.WriteString(hint.PlainLetter)
	}

	return ui.HintStyle.Render(fmt.Sprintf("Clues: %s", builder.String()))
}

func (m Model) renderStatus() string {
	switch m.state {
	case StateChecking:
		return ui.LoadingStyle.Render("Checking solution...")
	case StateSolved:
		return ui.SuccessStyle.Render(fmt.Sprintf("Congratulations! You solved it in %s!", formatElapsed(m.Elapsed())))
	default:
		if m.statusMsg != "" {
			return ui.ErrorStyle.Render(m.statusMsg)
		}
		return ""
	}
}

func (m Model) renderHelp() string {
	switch m.state {
	case StateChecking:
		return ""
	case StateSolved:
		if m.claimCode != "" {
			return ui.HelpStyle.Render("[s] Stats  [Esc] Quit")
		}
		return ui.HelpStyle.Render("[Esc] Quit  · Tip: run 'unquote register' to track your stats")
	default:
		return ui.HelpStyle.Render("[Enter] Submit  [Ctrl+C] Clear  [Esc] Quit")
	}
}

// viewOnboarding renders the huh onboarding form centered in the terminal.
func (m Model) viewOnboarding() string {
	if m.form == nil {
		return ""
	}
	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, m.form.View())
}

// formatMs formats milliseconds as M:SS (e.g. 128000 → "2:08").
func formatMs(ms float64) string {
	minutes := int(ms) / 60000
	seconds := (int(ms) % 60000) / 1000
	return fmt.Sprintf("%d:%02d", minutes, seconds)
}

// viewStats renders the stats screen with a solve-time graph and summary sidebar.
func (m Model) viewStats() string {
	header := m.renderHeader()

	if m.stats == nil {
		help := ui.HelpStyle.Render("[Esc] Quit")
		return lipgloss.JoinVertical(lipgloss.Left, header, "", ui.ErrorStyle.Render("Failed to load stats."), "", help)
	}

	const sidebarWidth = 28
	const dayWindow = 30

	// Build solve-time data points (last 30 days, NaN for missing days)
	solveMap := make(map[string]float64, len(m.stats.RecentSolves))
	for _, s := range m.stats.RecentSolves {
		solveMap[s.Date] = s.CompletionTime
	}

	points := make([]float64, dayWindow)
	hasData := false
	for i := range dayWindow {
		points[i] = math.NaN()
	}

	// Fill points from recentSolves (API returns them ordered; use date map).
	// Cap to dayWindow entries and right-align in the points array.
	n := len(m.stats.RecentSolves)
	if n > dayWindow {
		n = dayWindow
	}
	offset := dayWindow - n
	for i := range n {
		points[offset+i] = m.stats.RecentSolves[len(m.stats.RecentSolves)-n+i].CompletionTime / 60000.0
		hasData = true
	}

	// Build graph panel
	graphWidth := m.width - sidebarWidth - 6
	if graphWidth < 20 {
		graphWidth = 20
	}

	var graphPanel string
	if !hasData {
		graphPanel = ui.HelpStyle.Render("No solve history in the last 30 days.")
	} else {
		plot := asciigraph.Plot(points,
			asciigraph.Height(10),
			asciigraph.Width(graphWidth),
			asciigraph.Precision(1),
			asciigraph.LowerBound(0),
			asciigraph.Caption("Solve Times (last 30 days, minutes)"),
		)
		graphPanel = plot
	}

	// Build sidebar panel
	labelStyle := lipgloss.NewStyle().Foreground(ui.ColorMuted)
	valueStyle := lipgloss.NewStyle().Foreground(ui.ColorPrimary).Bold(true)

	formatOptMs := func(ms *float64) string {
		if ms == nil {
			return "—"
		}
		return formatMs(*ms)
	}

	winRatePct := fmt.Sprintf("%.1f%%", m.stats.WinRate*100)

	lines := []string{
		labelStyle.Render("Games Played"),
		valueStyle.Render(fmt.Sprintf("%d", m.stats.GamesPlayed)),
		"",
		labelStyle.Render("Games Solved"),
		valueStyle.Render(fmt.Sprintf("%d", m.stats.GamesSolved)),
		"",
		labelStyle.Render("Win Rate"),
		valueStyle.Render(winRatePct),
		"",
		labelStyle.Render("Current Streak"),
		valueStyle.Render(fmt.Sprintf("%d", m.stats.CurrentStreak)),
		"",
		labelStyle.Render("Best Streak"),
		valueStyle.Render(fmt.Sprintf("%d", m.stats.BestStreak)),
		"",
		labelStyle.Render("Best Time"),
		valueStyle.Render(formatOptMs(m.stats.BestTime)),
		"",
		labelStyle.Render("Avg Time"),
		valueStyle.Render(formatOptMs(m.stats.AverageTime)),
	}

	sidebarContent := strings.Join(lines, "\n")
	sidebarPanel := lipgloss.NewStyle().Width(sidebarWidth).Padding(0, 2).Render(sidebarContent)

	content := lipgloss.JoinHorizontal(lipgloss.Top, graphPanel, "  ", sidebarPanel)

	helpText := "[Esc] Quit"
	if !m.statsOnly {
		helpText = "[Esc] Back"
	}
	help := ui.HelpStyle.Render(helpText)

	return lipgloss.JoinVertical(lipgloss.Left, header, "", content, "", help)
}

// viewClaimCodeDisplay renders the claim code as a raffle-ticket style card.
func (m Model) viewClaimCodeDisplay() string {
	// innerWidth is the content area width. All items are constrained to this
	// so centering is consistent and nothing overflows the double-line border.
	const innerWidth = 50

	// centered applies a fixed width + center alignment to any style.
	centered := func(s lipgloss.Style) lipgloss.Style {
		return s.Width(innerWidth).Align(lipgloss.Center)
	}

	// Outer box uses a double border for the "ticket" look.
	// Width must be innerWidth + 2*horizontalPadding so the effective text area
	// inside the padding equals innerWidth (matching the centered() item widths).
	const hPad = 2
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.DoubleBorder()).
		BorderForeground(ui.ColorSuccess).
		Padding(1, hPad).
		Width(innerWidth + 2*hPad)

	// Perforated divider — dashes suggest a tear-off line between sections.
	divider := centered(lipgloss.NewStyle().Foreground(ui.ColorMuted)).
		Render(strings.Repeat("─", innerWidth-4))

	title := centered(lipgloss.NewStyle().Bold(true).Foreground(ui.ColorSuccess)).
		Render("★  Registration Complete!  ★")

	label := centered(lipgloss.NewStyle().Foreground(ui.ColorMuted).Bold(true)).
		Render("— YOUR CLAIM CODE —")

	// Build the scalloped claim code box.
	// All three rows share the same visible width so they align correctly.
	//
	//   ┌──────────────────────────────┐   ← top: ┌ + ─*n + ┐  (width = n+2)
	//    )   FRACTAL-CIPHER-3734   (       ← mid: sp + ) + pad + code + pad + ( + sp (= n+2)
	//   └──────────────────────────────┘   ← bot: └ + ─*n + ┘  (width = n+2)
	//
	// The ) and ( sit at the same column as the first/last ─, with corners
	// offset outward by one space — this gives the scalloped/carved edge look.
	//
	// Build as plain text first, then apply a single style so lipgloss can
	// measure the entire block reliably (no interleaved ANSI sequences).
	const codePad = 3
	// Claim codes are ASCII (A-Z, 0-9, -) so len == visible width.
	codeLen := len(m.claimCode)
	// n: all rows = n+2 wide; derived from mid row = 1+1+codePad+codeLen+codePad+1+1.
	n := codeLen + 2*codePad + 2
	plainBox := strings.Join([]string{
		"┌" + strings.Repeat("─", n) + "┐",
		" )" + strings.Repeat(" ", codePad) + m.claimCode + strings.Repeat(" ", codePad) + "( ",
		"└" + strings.Repeat("─", n) + "┘",
	}, "\n")
	scallopedCode := lipgloss.NewStyle().Bold(true).Foreground(ui.ColorPrimary).Render(plainBox)
	centeredCode := centered(lipgloss.NewStyle()).Render(scallopedCode)

	// Use a plain muted style (no PaddingTop) for the note/prompt lines. The
	// blank "" entries in JoinVertical already provide vertical separation, and
	// ui.HelpStyle's PaddingTop(1) causes lipgloss to word-wrap text that would
	// otherwise fit on a single line when combined with Width(innerWidth).
	noteStyle := lipgloss.NewStyle().Foreground(ui.ColorMuted)

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		"",
		divider,
		"",
		label,
		"",
		centeredCode,
		"",
		divider,
		"",
		centered(noteStyle).Render("Save this to access your stats from any device."),
		"",
		centered(noteStyle).Render("Press any key to continue..."),
	)

	box := boxStyle.Render(content)
	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, box)
}
