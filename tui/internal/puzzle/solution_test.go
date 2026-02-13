package puzzle

import "testing"

func TestAssembleSolution(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		filled   map[int]rune
		expected string
	}{
		{
			name:     "all filled",
			input:    "ABC",
			filled:   map[int]rune{0: 'X', 1: 'Y', 2: 'Z'},
			expected: "XYZ",
		},
		{
			name:     "partially filled",
			input:    "ABC",
			filled:   map[int]rune{0: 'X'},
			expected: "X__",
		},
		{
			name:     "with punctuation",
			input:    "A, B!",
			filled:   map[int]rune{0: 'X', 3: 'Y'},
			expected: "X, Y!",
		},
		{
			name:     "empty",
			input:    "ABC",
			filled:   map[int]rune{},
			expected: "___",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells := BuildCells(tt.input, nil)
			for idx, char := range tt.filled {
				cells[idx].Input = char
			}

			result := AssembleSolution(cells)
			if result != tt.expected {
				t.Errorf("AssembleSolution = %q, expected %q", result, tt.expected)
			}
		})
	}
}

func TestIsComplete(t *testing.T) {
	tests := []struct {
		filled   map[int]rune
		name     string
		input    string
		expected bool
	}{
		{
			name:     "all letters filled",
			input:    "ABC",
			filled:   map[int]rune{0: 'X', 1: 'Y', 2: 'Z'},
			expected: true,
		},
		{
			name:     "missing one",
			input:    "ABC",
			filled:   map[int]rune{0: 'X', 1: 'Y'},
			expected: false,
		},
		{
			name:     "with punctuation all filled",
			input:    "A, B",
			filled:   map[int]rune{0: 'X', 3: 'Y'},
			expected: true,
		},
		{
			name:     "empty cells",
			input:    "ABC",
			filled:   map[int]rune{},
			expected: false,
		},
		{
			name:     "no letters",
			input:    "...",
			filled:   map[int]rune{},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells := BuildCells(tt.input, nil)
			for idx, char := range tt.filled {
				cells[idx].Input = char
			}

			result := IsComplete(cells)
			if result != tt.expected {
				t.Errorf("IsComplete = %v, expected %v", result, tt.expected)
			}
		})
	}
}

func TestClearAllInput(t *testing.T) {
	cells := BuildCells("ABC", nil)
	cells[0].Input = 'X'
	cells[1].Input = 'Y'
	cells[2].Input = 'Z'

	ClearAllInput(cells)

	for i, cell := range cells {
		if cell.Input != 0 {
			t.Errorf("cell %d: expected Input 0, got %d", i, cell.Input)
		}
	}
}

func TestSetInput(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		index    int
		char     rune
		expected bool
	}{
		{"valid letter", "ABC", 1, 'X', true},
		{"invalid index negative", "ABC", -1, 'X', false},
		{"invalid index too large", "ABC", 5, 'X', false},
		{"non-letter cell", "A B", 1, 'X', false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cells := BuildCells(tt.input, nil)
			result := SetInput(cells, tt.index, tt.char)
			if result != tt.expected {
				t.Errorf("SetInput = %v, expected %v", result, tt.expected)
			}

			if result && cells[tt.index].Input != tt.char {
				t.Errorf("cell Input = %d, expected %d", cells[tt.index].Input, tt.char)
			}
		})
	}
}

func TestClearInputRejectsHintCell(t *testing.T) {
	hints := map[rune]rune{'A': 'X'}
	cells := BuildCells("AB", hints)

	// Attempt to clear hint cell A (index 0)
	result := ClearInput(cells, 0)
	if result != false {
		t.Error("ClearInput should return false for hint cell")
	}
	if cells[0].Input != 'X' {
		t.Errorf("hint cell Input should be unchanged, got %c", cells[0].Input)
	}
}

func TestSetInputRejectsHintCell(t *testing.T) {
	hints := map[rune]rune{'A': 'X'}
	cells := BuildCells("AB", hints)

	// Attempt to write to hint cell A (index 0)
	result := SetInput(cells, 0, 'Z')
	if result != false {
		t.Error("SetInput should return false for hint cell")
	}
	if cells[0].Input != 'X' {
		t.Errorf("hint cell Input should be unchanged, got %c", cells[0].Input)
	}

	// Writing to regular cell B (index 1) should succeed
	result = SetInput(cells, 1, 'Y')
	if result != true {
		t.Error("SetInput should return true for regular letter cell")
	}
	if cells[1].Input != 'Y' {
		t.Errorf("regular cell Input should be Y, got %c", cells[1].Input)
	}
}

func TestClearAllInputPreservesHints(t *testing.T) {
	hints := map[rune]rune{'A': 'X'}
	cells := BuildCells("AB", hints)
	cells[1].Input = 'Y' // Fill regular cell B

	ClearAllInput(cells)

	if cells[0].Input != 'X' {
		t.Errorf("hint cell A: expected Input 'X' preserved, got %c", cells[0].Input)
	}
	if cells[1].Input != 0 {
		t.Errorf("regular cell B: expected Input cleared, got %c", cells[1].Input)
	}
}

func TestAssembleSolutionWithHints(t *testing.T) {
	hints := map[rune]rune{'A': 'X'}
	cells := BuildCells("A, B", hints)
	cells[3].Input = 'Y' // Fill regular cell B

	result := AssembleSolution(cells)
	if result != "X, Y" {
		t.Errorf("AssembleSolution = %q, expected %q", result, "X, Y")
	}
}

func TestIsCompleteWithHints(t *testing.T) {
	hints := map[rune]rune{'A': 'X'}
	cells := BuildCells("AB", hints)

	// B is unfilled — should be incomplete
	if IsComplete(cells) {
		t.Error("expected incomplete when regular cell B is unfilled")
	}

	// Fill B — should be complete (hint A is already filled)
	cells[1].Input = 'Y'
	if !IsComplete(cells) {
		t.Error("expected complete when all cells filled (hint + regular)")
	}
}
