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
			cells := BuildCells(tt.input)
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
		name     string
		input    string
		filled   map[int]rune
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
			cells := BuildCells(tt.input)
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
	cells := BuildCells("ABC")
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
			cells := BuildCells(tt.input)
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
