package app

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"

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

	// Derive highlight character from cursor position
	// Only highlight if cursor is on a letter cell
	var highlightChar rune
	if m.cursorPos >= 0 && m.cursorPos < len(m.cells) && m.cells[m.cursorPos].Kind == puzzle.CellLetter {
		highlightChar = m.cells[m.cursorPos].Char
	}

	// Find duplicate input assignments for warning highlights
	duplicateInputs := findDuplicateInputs(m.cells)

	// Group cells by word and wrap into lines
	groups := ui.GroupCellsByWord(m.cells)
	lines := ui.WrapWordGroups(groups, maxLineWidth, cellWidth)

	var renderedLines []string
	for _, line := range lines {
		cells := ui.FlattenLine(line)
		renderedLines = append(renderedLines, m.renderLine(cells, highlightChar, duplicateInputs))
	}

	return strings.Join(renderedLines, "\n\n")
}

// renderLine renders a single line with input row above cipher row
func (m Model) renderLine(cells []puzzle.Cell, highlightChar rune, duplicateInputs map[rune]bool) string {
	var columns []string

	for _, cell := range cells {
		inputContent := m.renderInputCell(cell, highlightChar, duplicateInputs)
		cipherContent := m.renderCipherCell(cell)

		// Join input and cipher vertically to form a column
		column := lipgloss.JoinVertical(lipgloss.Left, inputContent, cipherContent)

		// Wrap letter cell columns with zone marker for click detection
		// This creates a single zone spanning both rows
		if cell.Kind == puzzle.CellLetter {
			column = zone.Mark(fmt.Sprintf("cell-%d", cell.Index), column)
		}

		columns = append(columns, column)
	}

	return lipgloss.JoinHorizontal(lipgloss.Top, columns...)
}

// renderInputCell renders the user input cell (top row)
func (m Model) renderInputCell(cell puzzle.Cell, highlightChar rune, duplicateInputs map[rune]bool) string {
	if cell.Kind != puzzle.CellLetter {
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

	// Highlight if this is the cursor position (takes precedence)
	if cell.Index == m.cursorPos {
		return ui.ActiveCellStyle.Render(content)
	}

	// Highlight duplicate input assignments (warning)
	if cell.Input != 0 && duplicateInputs[cell.Input] {
		return ui.DuplicateInputStyle.Render(content)
	}

	// Highlight related cells (same cipher letter as cursor)
	if highlightChar != 0 && cell.Char == highlightChar {
		return ui.RelatedCellStyle.Render(content)
	}

	return ui.CellStyle.Render(content)
}

// renderCipherCell renders the cipher letter cell (bottom row)
func (m Model) renderCipherCell(cell puzzle.Cell) string {
	if cell.Kind != puzzle.CellLetter {
		// Non-letter: empty space below punctuation
		return ui.CipherStyle.Render(" ")
	}

	return ui.CipherStyle.Render(string(cell.Char))
}

// findDuplicateInputs scans cells and returns the set of plaintext input
// letters that are assigned to two or more distinct cipher letters. This
// identifies conflicting assignments the player should be warned about.
func findDuplicateInputs(cells []puzzle.Cell) map[rune]bool {
	// Map each plaintext input to the set of cipher letters it's assigned to
	inputToCiphers := make(map[rune]map[rune]bool)

	for _, cell := range cells {
		if cell.Kind != puzzle.CellLetter || cell.Input == 0 {
			continue
		}
		if inputToCiphers[cell.Input] == nil {
			inputToCiphers[cell.Input] = make(map[rune]bool)
		}
		inputToCiphers[cell.Input][cell.Char] = true
	}

	// Any input mapped to 2+ distinct cipher letters is a duplicate
	duplicates := make(map[rune]bool)
	for input, ciphers := range inputToCiphers {
		if len(ciphers) >= 2 {
			duplicates[input] = true
		}
	}

	return duplicates
}
