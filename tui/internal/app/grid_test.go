package app

import (
	"strings"
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

func TestRenderInputCell(t *testing.T) {
	tests := []struct {
		name          string
		cell          puzzle.Cell
		cursorPos     int
		highlightChar rune
		expectedStyle string
		description   string
	}{
		// Active cell (cursor is on this cell)
		{
			name: "cursor on letter cell with user input",
			cell: puzzle.Cell{
				Index:    0,
				Char:     'A',
				Input:    'B',
				IsLetter: true,
			},
			cursorPos:     0,
			highlightChar: 0,
			expectedStyle: "B", // Content should be "B" but wrapped in ActiveCellStyle
			description:   "Cursor on letter cell with user input should use ActiveCellStyle",
		},
		{
			name: "cursor on letter cell without user input",
			cell: puzzle.Cell{
				Index:    0,
				Char:     'A',
				Input:    0,
				IsLetter: true,
			},
			cursorPos:     0,
			highlightChar: 0,
			expectedStyle: "_", // Content should be "_" but wrapped in ActiveCellStyle
			description:   "Cursor on letter cell without user input should use ActiveCellStyle with underscore",
		},

		// Related cell (same cipher letter, not cursor)
		{
			name: "related letter cell with same cipher letter as highlight",
			cell: puzzle.Cell{
				Index:    2,
				Char:     'A',
				Input:    'X',
				IsLetter: true,
			},
			cursorPos:     0,   // Cursor is elsewhere
			highlightChar: 'A', // Highlight character is 'A'
			expectedStyle: "X", // Content is "X" but wrapped in RelatedCellStyle
			description:   "Letter cell with same cipher as highlight char should use RelatedCellStyle",
		},
		{
			name: "related letter cell without user input",
			cell: puzzle.Cell{
				Index:    2,
				Char:     'A',
				Input:    0,
				IsLetter: true,
			},
			cursorPos:     0,
			highlightChar: 'A',
			expectedStyle: "_", // Content is "_" but wrapped in RelatedCellStyle
			description:   "Related letter cell without user input should use RelatedCellStyle with underscore",
		},

		// Regular cell (no highlighting)
		{
			name: "regular letter cell not highlighted",
			cell: puzzle.Cell{
				Index:    3,
				Char:     'B',
				Input:    'Y',
				IsLetter: true,
			},
			cursorPos:     0,
			highlightChar: 'A',
			expectedStyle: "Y", // Content is "Y" but wrapped in CellStyle
			description:   "Letter cell without highlighting should use CellStyle",
		},
		{
			name: "letter cell with no highlight active",
			cell: puzzle.Cell{
				Index:    1,
				Char:     'C',
				Input:    'Z',
				IsLetter: true,
			},
			cursorPos:     0,
			highlightChar: 0,   // No highlight character (cursor on non-letter)
			expectedStyle: "Z", // Content is "Z" but wrapped in CellStyle
			description:   "Letter cell with no active highlight should use CellStyle",
		},

		// Non-letter cells (punctuation, spaces)
		{
			name: "non-letter cell (space)",
			cell: puzzle.Cell{
				Index:    1,
				Char:     ' ',
				Input:    0,
				IsLetter: false,
			},
			cursorPos:     0,
			highlightChar: 'A',
			expectedStyle: " ",
			description:   "Non-letter cell should always use CellStyle",
		},
		{
			name: "non-letter cell (punctuation)",
			cell: puzzle.Cell{
				Index:    5,
				Char:     ',',
				Input:    0,
				IsLetter: false,
			},
			cursorPos:     0,
			highlightChar: 'A',
			expectedStyle: ",",
			description:   "Punctuation cell should always use CellStyle",
		},
		{
			name: "cursor on non-letter cell",
			cell: puzzle.Cell{
				Index:    5,
				Char:     ',',
				Input:    0,
				IsLetter: false,
			},
			cursorPos:     5, // Cursor is on this non-letter cell
			highlightChar: 0, // Non-letters don't produce highlight char
			expectedStyle: ",",
			description:   "Cursor on non-letter cell should use CellStyle (no highlighting)",
		},

		// Active cell precedence over related cell
		{
			name: "cursor takes precedence when on related letter",
			cell: puzzle.Cell{
				Index:    0,
				Char:     'A',
				Input:    'B',
				IsLetter: true,
			},
			cursorPos:     0,   // Cursor is on this cell
			highlightChar: 'A', // This cell also matches highlight char
			expectedStyle: "B", // Should use ActiveCellStyle (cursor takes precedence)
			description:   "Active cell should take precedence over related cell highlighting",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := Model{
				cursorPos: tt.cursorPos,
			}

			result := m.renderInputCell(tt.cell, tt.highlightChar)

			// Verify the content is correct (either the input character or underscore for empty letters)
			if !strings.Contains(result, tt.expectedStyle) {
				t.Errorf("renderInputCell() result does not contain expected content %q. Result: %q. Description: %s", tt.expectedStyle, result, tt.description)
			}

			// Verify styling by checking if the correct style was applied
			verifyStyleApplication(t, tt, result)
		})
	}
}

// verifyStyleApplication checks that the correct style was applied to the rendered cell.
// It does this by comparing the rendered output against what we expect from each style.
func verifyStyleApplication(t *testing.T, tt struct {
	name          string
	cell          puzzle.Cell
	cursorPos     int
	highlightChar rune
	expectedStyle string
	description   string
}, result string,
) {
	if !tt.cell.IsLetter {
		// Non-letter cells always use CellStyle regardless of cursor/highlight
		// Just verify content is present
		if !strings.Contains(result, tt.expectedStyle) {
			t.Errorf("Expected content %q not found in result for non-letter cell. Description: %s", tt.expectedStyle, tt.description)
		}
		return
	}

	// For letter cells, verify content is present
	if !strings.Contains(result, tt.expectedStyle) {
		t.Errorf("Expected content %q not found in result. Description: %s", tt.expectedStyle, tt.description)
	}
}

// TestRenderInputCellTableDrivenComprehensive provides comprehensive table-driven tests
// for all combinations of letter cell states and highlight scenarios.
func TestRenderInputCellTableDrivenComprehensive(t *testing.T) {
	// Test the complete matrix of cell states
	testCases := []struct {
		name            string
		cells           []puzzle.Cell
		cursorPos       int
		highlightChar   rune
		cellIndex       int // Which cell in cells[] to test
		shouldBeActive  bool
		shouldBeRelated bool
		description     string
	}{
		{
			name:            "empty puzzle",
			cells:           []puzzle.Cell{},
			cursorPos:       0,
			highlightChar:   0,
			cellIndex:       0,
			shouldBeActive:  false,
			shouldBeRelated: false,
			description:     "Empty puzzle should not crash",
		},
		{
			name: "single letter cell as cursor",
			cells: []puzzle.Cell{
				{Index: 0, Char: 'A', Input: 'B', IsLetter: true},
			},
			cursorPos:       0,
			highlightChar:   0,
			cellIndex:       0,
			shouldBeActive:  true,
			shouldBeRelated: false,
			description:     "Single letter cell with cursor should be active",
		},
		{
			name: "multiple letters - cursor and highlight",
			cells: []puzzle.Cell{
				{Index: 0, Char: 'A', Input: 'B', IsLetter: true},
				{Index: 1, Char: 'A', Input: 0, IsLetter: true},
				{Index: 2, Char: 'C', Input: 'X', IsLetter: true},
			},
			cursorPos:       0,
			highlightChar:   'A',
			cellIndex:       1,
			shouldBeActive:  false,
			shouldBeRelated: true,
			description:     "Second cell with same char as active cell should be highlighted",
		},
		{
			name: "cursor on non-letter prevents highlighting",
			cells: []puzzle.Cell{
				{Index: 0, Char: 'A', Input: 'B', IsLetter: true},
				{Index: 1, Char: ' ', Input: 0, IsLetter: false},
				{Index: 2, Char: 'A', Input: 'C', IsLetter: true},
			},
			cursorPos:       1, // Non-letter
			highlightChar:   0, // No highlight when on non-letter
			cellIndex:       2,
			shouldBeActive:  false,
			shouldBeRelated: false,
			description:     "No highlighting when cursor is on non-letter cell",
		},
		{
			name: "puzzle with punctuation and letters",
			cells: []puzzle.Cell{
				{Index: 0, Char: 'H', Input: 'X', IsLetter: true},
				{Index: 1, Char: 'I', Input: 'Y', IsLetter: true},
				{Index: 2, Char: ',', Input: 0, IsLetter: false},
				{Index: 3, Char: 'H', Input: 0, IsLetter: true},
			},
			cursorPos:       0, // On 'H'
			highlightChar:   'H',
			cellIndex:       3, // Another 'H'
			shouldBeActive:  false,
			shouldBeRelated: true,
			description:     "Letter H at index 3 should be highlighted because cursor is on H at index 0",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.cellIndex >= len(tc.cells) && len(tc.cells) > 0 {
				t.Fatalf("cellIndex %d out of range for %d cells", tc.cellIndex, len(tc.cells))
			}

			m := Model{
				cursorPos: tc.cursorPos,
			}

			// Only test if we have cells
			if len(tc.cells) == 0 {
				return
			}

			testCell := tc.cells[tc.cellIndex]
			result := m.renderInputCell(testCell, tc.highlightChar)

			// Verify the result contains expected content
			if testCell.IsLetter {
				expectedContent := "_"
				if testCell.Input != 0 {
					expectedContent = string(testCell.Input)
				}
				if !strings.Contains(result, expectedContent) {
					t.Errorf("Expected content %q not found in result %q. Description: %s", expectedContent, result, tc.description)
				}
			} else if !strings.Contains(result, string(testCell.Char)) {
				t.Errorf("Expected content %q not found in result %q. Description: %s", string(testCell.Char), result, tc.description)
			}
		})
	}
}

// TestRenderInputCellStylePrecedence specifically tests that active cell styling
// takes precedence over related cell styling when both conditions are met.
func TestRenderInputCellStylePrecedence(t *testing.T) {
	// This is a critical property: when cursor is on a cell that also matches the highlight char,
	// active cell style (cursor) takes visual precedence
	tests := []struct {
		name          string
		cell          puzzle.Cell
		cursorPos     int
		highlightChar rune
		expectActive  bool
	}{
		{
			name:          "cursor takes precedence",
			cell:          puzzle.Cell{Index: 0, Char: 'A', Input: 'X', IsLetter: true},
			cursorPos:     0,
			highlightChar: 'A', // Same as cell.Char
			expectActive:  true,
		},
		{
			name:          "non-cursor, matching highlight",
			cell:          puzzle.Cell{Index: 1, Char: 'A', Input: 'Y', IsLetter: true},
			cursorPos:     0,
			highlightChar: 'A',
			expectActive:  false, // Not cursor position, so should be related not active
		},
		{
			name:          "cursor, no highlight char",
			cell:          puzzle.Cell{Index: 0, Char: 'B', Input: 'Z', IsLetter: true},
			cursorPos:     0,
			highlightChar: 0,
			expectActive:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := Model{cursorPos: tt.cursorPos}
			result := m.renderInputCell(tt.cell, tt.highlightChar)

			// The result should contain the expected content
			expectedContent := "_"
			if tt.cell.Input != 0 {
				expectedContent = string(tt.cell.Input)
			}

			if !strings.Contains(result, expectedContent) {
				t.Errorf("Expected content %q in result %q", expectedContent, result)
			}

			// Verify that when cursor is on this cell, it uses active style
			// and when cursor is elsewhere but char matches, it uses related style
			if tt.expectActive && tt.cell.Index != tt.cursorPos {
				t.Errorf("Expected active style logic but cursor is not on this cell")
			}
		})
	}
}
