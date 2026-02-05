package puzzle

import "testing"

func TestBuildCells(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedLetter []bool
		expectedLen    int
	}{
		{
			name:           "simple word",
			input:          "HELLO",
			expectedLen:    5,
			expectedLetter: []bool{true, true, true, true, true},
		},
		{
			name:           "with spaces",
			input:          "HI THERE",
			expectedLen:    8,
			expectedLetter: []bool{true, true, false, true, true, true, true, true},
		},
		{
			name:           "with punctuation",
			input:          "HELLO, WORLD!",
			expectedLen:    13,
			expectedLetter: []bool{true, true, true, true, true, false, false, true, true, true, true, true, false},
		},
		{
			name:           "empty string",
			input:          "",
			expectedLen:    0,
			expectedLetter: []bool{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells := BuildCells(tt.input)

			if len(cells) != tt.expectedLen {
				t.Errorf("expected %d cells, got %d", tt.expectedLen, len(cells))
			}

			for i, cell := range cells {
				if cell.Index != i {
					t.Errorf("cell %d: expected Index %d, got %d", i, i, cell.Index)
				}
				if i < len(tt.expectedLetter) && cell.IsLetter != tt.expectedLetter[i] {
					t.Errorf("cell %d: expected IsLetter %v, got %v", i, tt.expectedLetter[i], cell.IsLetter)
				}
				if cell.Input != 0 {
					t.Errorf("cell %d: expected Input to be 0, got %d", i, cell.Input)
				}
			}
		})
	}
}

func TestNextLetterCell(t *testing.T) {
	cells := BuildCells("A, B")

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
	cells := BuildCells("A, BC")
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
	cells := BuildCells("A, B")

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
			cells := BuildCells(tt.input)
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
			cells := BuildCells(tt.input)
			result := LastLetterCell(cells)
			if result != tt.expected {
				t.Errorf("LastLetterCell = %d, expected %d", result, tt.expected)
			}
		})
	}
}
