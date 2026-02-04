package puzzle

import "testing"

func TestDifficultyText(t *testing.T) {
	tests := []struct {
		score    int
		expected string
	}{
		// Easy (0-25)
		{0, "Easy"},
		{10, "Easy"},
		{25, "Easy"},
		// Medium (26-50)
		{26, "Medium"},
		{40, "Medium"},
		{50, "Medium"},
		// Hard (51-75)
		{51, "Hard"},
		{60, "Hard"},
		{75, "Hard"},
		// Expert (76-100)
		{76, "Expert"},
		{90, "Expert"},
		{100, "Expert"},
	}

	for _, tt := range tests {
		result := DifficultyText(tt.score)
		if result != tt.expected {
			t.Errorf("DifficultyText(%d) = %q, expected %q", tt.score, result, tt.expected)
		}
	}
}
