package ui

import (
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

func TestGroupCellsByWord(t *testing.T) {
	cells := puzzle.BuildCells("HI THERE")
	groups := GroupCellsByWord(cells)

	// Should have: "HI", " ", "THERE"
	if len(groups) != 3 {
		t.Errorf("expected 3 groups, got %d", len(groups))
	}

	if len(groups[0].Cells) != 2 {
		t.Errorf("expected 2 cells in first group (HI), got %d", len(groups[0].Cells))
	}

	if len(groups[1].Cells) != 1 || groups[1].Cells[0].Char != ' ' {
		t.Error("expected space as second group")
	}

	if len(groups[2].Cells) != 5 {
		t.Errorf("expected 5 cells in third group (THERE), got %d", len(groups[2].Cells))
	}
}

func TestWrapWordGroups(t *testing.T) {
	cells := puzzle.BuildCells("ONE TWO THREE FOUR")
	groups := GroupCellsByWord(cells)

	// With cellWidth=3 and maxWidth=15, should fit ~5 chars per line
	// "ONE" = 3*3=9, " TWO" = 4*3=12 -> total 21 > 15
	// So "ONE" on first line, "TWO" starts second line
	lines := WrapWordGroups(groups, 15, 3)

	if len(lines) < 2 {
		t.Errorf("expected at least 2 lines, got %d", len(lines))
	}
}

func TestFlattenLine(t *testing.T) {
	cells := puzzle.BuildCells("AB CD")
	groups := GroupCellsByWord(cells)

	// Flatten first line (assuming it contains all)
	flattened := FlattenLine(groups)

	if len(flattened) != 5 {
		t.Errorf("expected 5 cells, got %d", len(flattened))
	}
}

func TestWordWrapText(t *testing.T) {
	tests := []struct {
		text     string
		maxWidth int
		expected string
	}{
		{"hello world", 20, "hello world"},
		{"hello world", 6, "hello\nworld"},
		{"a b c d e", 5, "a b c\nd e"},
		{"", 10, ""},
	}

	for _, tt := range tests {
		result := WordWrapText(tt.text, tt.maxWidth)
		if result != tt.expected {
			t.Errorf("WordWrapText(%q, %d) = %q, expected %q", tt.text, tt.maxWidth, result, tt.expected)
		}
	}
}
