package puzzle

import "testing"

func TestBuildCells(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		expectedKind []CellKind
		expectedLen  int
	}{
		{
			name:         "simple word",
			input:        "HELLO",
			expectedLen:  5,
			expectedKind: []CellKind{CellLetter, CellLetter, CellLetter, CellLetter, CellLetter},
		},
		{
			name:         "with spaces",
			input:        "HI THERE",
			expectedLen:  8,
			expectedKind: []CellKind{CellLetter, CellLetter, CellPunctuation, CellLetter, CellLetter, CellLetter, CellLetter, CellLetter},
		},
		{
			name:         "with punctuation",
			input:        "HELLO, WORLD!",
			expectedLen:  13,
			expectedKind: []CellKind{CellLetter, CellLetter, CellLetter, CellLetter, CellLetter, CellPunctuation, CellPunctuation, CellLetter, CellLetter, CellLetter, CellLetter, CellLetter, CellPunctuation},
		},
		{
			name:         "empty string",
			input:        "",
			expectedLen:  0,
			expectedKind: []CellKind{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells := BuildCells(tt.input, nil)

			if len(cells) != tt.expectedLen {
				t.Errorf("expected %d cells, got %d", tt.expectedLen, len(cells))
			}

			for i, cell := range cells {
				if cell.Index != i {
					t.Errorf("cell %d: expected Index %d, got %d", i, i, cell.Index)
				}
				if i < len(tt.expectedKind) && cell.Kind != tt.expectedKind[i] {
					t.Errorf("cell %d: expected Kind %v, got %v", i, tt.expectedKind[i], cell.Kind)
				}
				if cell.Input != 0 {
					t.Errorf("cell %d: expected Input to be 0, got %d", i, cell.Input)
				}
			}
		})
	}
}

func TestNextLetterCell(t *testing.T) {
	cells := BuildCells("A, B", nil)

	tests := []struct {
		currentPos int
		expected   int
	}{
		{0, 3},  // A -> B (skipping comma and space)
		{1, 3},  // comma -> B
		{2, 3},  // space -> B
		{3, -1}, // B -> none
	}

	for _, tt := range tests {
		result := NextLetterCell(cells, tt.currentPos)
		if result != tt.expected {
			t.Errorf("NextLetterCell(%d) = %d, expected %d", tt.currentPos, result, tt.expected)
		}
	}
}

func TestNextUnfilledLetterCell(t *testing.T) {
	cells := BuildCells("A, BC", nil)
	// Fill some cells: A is filled, B is unfilled, C is filled
	cells[0].Input = 'X' // A is filled
	cells[4].Input = 'Z' // C is filled

	tests := []struct {
		name       string
		currentPos int
		expected   int
	}{
		{"from filled A skips to unfilled B", 0, 3},
		{"from comma finds unfilled B", 1, 3},
		{"from space finds unfilled B", 2, 3},
		{"from unfilled B returns -1 (C is filled)", 3, -1},
		{"from filled C returns -1", 4, -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NextUnfilledLetterCell(cells, tt.currentPos)
			if result != tt.expected {
				t.Errorf("NextUnfilledLetterCell(%d) = %d, expected %d", tt.currentPos, result, tt.expected)
			}
		})
	}
}

func TestPrevLetterCell(t *testing.T) {
	cells := BuildCells("A, B", nil)

	tests := []struct {
		currentPos int
		expected   int
	}{
		{3, 0},  // B -> A
		{2, 0},  // space -> A
		{1, 0},  // comma -> A
		{0, -1}, // A -> none
	}

	for _, tt := range tests {
		result := PrevLetterCell(cells, tt.currentPos)
		if result != tt.expected {
			t.Errorf("PrevLetterCell(%d) = %d, expected %d", tt.currentPos, result, tt.expected)
		}
	}
}

func TestFirstLetterCell(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int
	}{
		{"starts with letter", "HELLO", 0},
		{"starts with punctuation", "...ABC", 3},
		{"no letters", "123", -1},
		{"empty", "", -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells := BuildCells(tt.input, nil)
			result := FirstLetterCell(cells)
			if result != tt.expected {
				t.Errorf("FirstLetterCell = %d, expected %d", result, tt.expected)
			}
		})
	}
}

func TestLastLetterCell(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int
	}{
		{"ends with letter", "HELLO", 4},
		{"ends with punctuation", "ABC...", 2},
		{"no letters", "123", -1},
		{"empty", "", -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells := BuildCells(tt.input, nil)
			result := LastLetterCell(cells)
			if result != tt.expected {
				t.Errorf("LastLetterCell = %d, expected %d", result, tt.expected)
			}
		})
	}
}

func TestBuildCellsWithHints(t *testing.T) {
	// Encrypted text: "AB, CD" where A->X and C->Z are hints
	hints := map[rune]rune{'A': 'X', 'C': 'Z'}
	cells := BuildCells("AB, CD", hints)

	tests := []struct {
		name          string
		index         int
		expectedKind  CellKind
		expectedChar  rune
		expectedInput rune
	}{
		{"hint cell A", 0, CellHint, 'A', 'X'},
		{"regular letter B", 1, CellLetter, 'B', 0},
		{"comma", 2, CellPunctuation, ',', 0},
		{"space", 3, CellPunctuation, ' ', 0},
		{"hint cell C", 4, CellHint, 'C', 'Z'},
		{"regular letter D", 5, CellLetter, 'D', 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cell := cells[tt.index]
			if cell.Kind != tt.expectedKind {
				t.Errorf("expected Kind %v, got %v", tt.expectedKind, cell.Kind)
			}
			if cell.Char != tt.expectedChar {
				t.Errorf("expected Char %c, got %c", tt.expectedChar, cell.Char)
			}
			if cell.Input != tt.expectedInput {
				t.Errorf("expected Input %c, got %c", tt.expectedInput, cell.Input)
			}
		})
	}
}

func TestBuildCellsHintDuplicates(t *testing.T) {
	// "ABA" with A->X hint — both A cells should be CellHint
	hints := map[rune]rune{'A': 'X'}
	cells := BuildCells("ABA", hints)

	if cells[0].Kind != CellHint || cells[0].Input != 'X' {
		t.Errorf("cell 0: expected CellHint with Input 'X', got Kind=%v Input=%c", cells[0].Kind, cells[0].Input)
	}
	if cells[1].Kind != CellLetter {
		t.Errorf("cell 1: expected CellLetter, got %v", cells[1].Kind)
	}
	if cells[2].Kind != CellHint || cells[2].Input != 'X' {
		t.Errorf("cell 2: expected CellHint with Input 'X', got Kind=%v Input=%c", cells[2].Kind, cells[2].Input)
	}
}

func TestBuildCellsNilHints(t *testing.T) {
	cells := BuildCells("A, B", nil)

	// With nil hints, letters should be CellLetter and non-letters CellPunctuation
	expectedKinds := []CellKind{CellLetter, CellPunctuation, CellPunctuation, CellLetter}
	for i, cell := range cells {
		if cell.Kind != expectedKinds[i] {
			t.Errorf("cell %d: expected Kind %v with nil hints, got %v", i, expectedKinds[i], cell.Kind)
		}
		if cell.Input != 0 {
			t.Errorf("cell %d: expected Input 0 with nil hints, got %c", i, cell.Input)
		}
	}
}
