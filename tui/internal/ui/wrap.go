package ui

import (
	"strings"

	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

// WordGroup represents a word and its cells for word-aware line wrapping
type WordGroup struct {
	Cells []puzzle.Cell
}

// GroupCellsByWord splits cells into word groups at spaces
func GroupCellsByWord(cells []puzzle.Cell) []WordGroup {
	var groups []WordGroup
	var currentWord []puzzle.Cell

	for _, cell := range cells {
		if cell.Char == ' ' {
			if len(currentWord) > 0 {
				groups = append(groups, WordGroup{Cells: currentWord})
				currentWord = nil
			}
			// Add space as its own group for proper spacing
			groups = append(groups, WordGroup{Cells: []puzzle.Cell{cell}})
		} else {
			currentWord = append(currentWord, cell)
		}
	}

	// Don't forget the last word
	if len(currentWord) > 0 {
		groups = append(groups, WordGroup{Cells: currentWord})
	}

	return groups
}

// WrapWordGroups distributes word groups across lines based on max width
// Returns a slice of lines, where each line is a slice of word groups
func WrapWordGroups(groups []WordGroup, maxWidth, cellWidth int) [][]WordGroup {
	var lines [][]WordGroup
	var currentLine []WordGroup
	currentWidth := 0

	for _, group := range groups {
		groupWidth := len(group.Cells) * cellWidth

		// Skip leading spaces on new lines
		if currentWidth == 0 && len(group.Cells) == 1 && group.Cells[0].Char == ' ' {
			continue
		}

		// Check if this group fits on the current line
		if currentWidth+groupWidth > maxWidth && currentWidth > 0 {
			// Start a new line
			lines = append(lines, currentLine)
			currentLine = nil
			currentWidth = 0

			// Skip leading spaces on new line
			if len(group.Cells) == 1 && group.Cells[0].Char == ' ' {
				continue
			}
		}

		currentLine = append(currentLine, group)
		currentWidth += groupWidth
	}

	// Don't forget the last line
	if len(currentLine) > 0 {
		lines = append(lines, currentLine)
	}

	return lines
}

// FlattenLine converts a line of word groups back to a cell slice
func FlattenLine(groups []WordGroup) []puzzle.Cell {
	var cells []puzzle.Cell
	for _, group := range groups {
		cells = append(cells, group.Cells...)
	}
	return cells
}

// WordWrapText wraps plain text at word boundaries
func WordWrapText(text string, maxWidth int) string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return ""
	}

	var lines []string
	currentLine := words[0]

	for _, word := range words[1:] {
		if len(currentLine)+1+len(word) > maxWidth {
			lines = append(lines, currentLine)
			currentLine = word
		} else {
			currentLine += " " + word
		}
	}
	lines = append(lines, currentLine)

	return strings.Join(lines, "\n")
}
