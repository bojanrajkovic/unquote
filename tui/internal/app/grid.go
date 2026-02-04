package app

import (
	"strings"
	"unicode"

	"github.com/charmbracelet/lipgloss"

	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/ui"
)

const (
	cellWidth    = 3
	maxLineWidth = 60
)

// renderGrid renders the puzzle grid with input cells above cipher letters
func (m Model) renderGrid() string {
	if len(m.cells) == 0 {
		return ""
	}

	// Group cells by word and wrap into lines
	groups := ui.GroupCellsByWord(m.cells)
	lines := ui.WrapWordGroups(groups, maxLineWidth, cellWidth)

	var renderedLines []string
	for _, line := range lines {
		cells := ui.FlattenLine(line)
		renderedLines = append(renderedLines, m.renderLine(cells))
	}

	return strings.Join(renderedLines, "\n\n")
}

// renderLine renders a single line with input row above cipher row
func (m Model) renderLine(cells []puzzle.Cell) string {
	var inputCells []string
	var cipherCells []string

	for _, cell := range cells {
		inputCells = append(inputCells, m.renderInputCell(cell))
		cipherCells = append(cipherCells, m.renderCipherCell(cell))
	}

	inputRow := lipgloss.JoinHorizontal(lipgloss.Top, inputCells...)
	cipherRow := lipgloss.JoinHorizontal(lipgloss.Top, cipherCells...)

	return lipgloss.JoinVertical(lipgloss.Left, inputRow, cipherRow)
}

// renderInputCell renders the user input cell (top row)
func (m Model) renderInputCell(cell puzzle.Cell) string {
	if !cell.IsLetter {
		// Non-letter: show the character as-is (punctuation, space)
		return ui.CellStyle.Render(string(cell.Char))
	}

	// Letter cell: show user input or underscore
	var content string
	if cell.Input != 0 {
		content = string(unicode.ToUpper(cell.Input))
	} else {
		content = "_"
	}

	// Highlight if this is the cursor position
	if cell.Index == m.cursorPos {
		return ui.ActiveCellStyle.Render(content)
	}

	return ui.CellStyle.Render(content)
}

// renderCipherCell renders the cipher letter cell (bottom row)
func (m Model) renderCipherCell(cell puzzle.Cell) string {
	if !cell.IsLetter {
		// Non-letter: empty space below punctuation
		return ui.CipherStyle.Render(" ")
	}

	return ui.CipherStyle.Render(string(cell.Char))
}
