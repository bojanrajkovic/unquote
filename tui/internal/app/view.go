package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/ui"
)

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
	content := ui.LoadingStyle.Render("Loading puzzle...")
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

	// Difficulty
	diffText := puzzle.DifficultyText(m.puzzle.Difficulty)
	difficulty := ui.DifficultyStyle.Render(fmt.Sprintf("Difficulty: %s", diffText))

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

	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		difficulty,
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
		return ui.SuccessStyle.Render("Congratulations! You solved it!")
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
		return ui.HelpStyle.Render("[Esc] Quit")
	default:
		return ui.HelpStyle.Render("[Enter] Submit  [Ctrl+C] Clear  [Esc] Quit")
	}
}
