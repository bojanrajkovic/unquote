package puzzle

import "testing"

func TestDifficultyText(t *testing.T) {
	tests := []struct {
		expected string
		score    int
	}{
		// Easy (0-25)
		{"Easy", 0},
		{"Easy", 10},
		{"Easy", 25},
		// Medium (26-50)
		{"Medium", 26},
		{"Medium", 40},
		{"Medium", 50},
		// Hard (51-75)
		{"Hard", 51},
		{"Hard", 60},
		{"Hard", 75},
		// Expert (76-100)
		{"Expert", 76},
		{"Expert", 90},
		{"Expert", 100},
	}

	for _, tt := range tests {
		result := DifficultyText(tt.score)
		if result != tt.expected {
			t.Errorf("DifficultyText(%d) = %q, expected %q", tt.score, result, tt.expected)
		}
	}
}
