package share

import (
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

// Helper to create SessionShareData without field alignment issues
func newSessionData(puzzleNum string, solved bool, completionMs int64, cells []puzzle.Cell, streak *int) SessionShareData {
	return SessionShareData{
		Cells:         cells,
		CompletionMs:  completionMs,
		PuzzleNumber:  puzzleNum,
		CurrentStreak: streak,
		Solved:        solved,
	}
}

// Test FormatSessionText header with solved puzzle
func TestFormatSessionText_SolvedHeader(t *testing.T) {
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if !contains(result, "UNQUOTE #2026-03-07") {
		t.Errorf("missing puzzle number in header")
	}
	if !contains(result, "✅") {
		t.Errorf("missing solved emoji in header")
	}
	if !contains(result, "2:08") {
		t.Errorf("missing completion time in header")
	}
}

// Test FormatSessionText header with unsolved puzzle
func TestFormatSessionText_UnsolvedHeader(t *testing.T) {
	data := newSessionData("2026-03-07", false, 0, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if !contains(result, "UNQUOTE #2026-03-07") {
		t.Errorf("missing puzzle number in header")
	}
	if !contains(result, "❌") {
		t.Errorf("missing unsolved emoji in header")
	}
}

// Test FormatSessionText includes footer URL
func TestFormatSessionText_Footer(t *testing.T) {
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if !contains(result, "playunquote.com") {
		t.Errorf("missing footer URL")
	}
}

// Test FormatSessionText includes streak when CurrentStreak is set and > 0
func TestFormatSessionText_WithStreak(t *testing.T) {
	streak := 12
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, &streak)

	result := FormatSessionText(data)

	if !contains(result, "🔥") {
		t.Errorf("missing streak emoji")
	}
	if !contains(result, "12-day streak") {
		t.Errorf("missing streak text")
	}
}

// Test FormatSessionText omits streak when CurrentStreak is nil
func TestFormatSessionText_NoStreakNil(t *testing.T) {
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if contains(result, "🔥") {
		t.Errorf("should not include streak emoji when CurrentStreak is nil")
	}
	if contains(result, "day streak") {
		t.Errorf("should not include streak text when CurrentStreak is nil")
	}
}

// Test FormatSessionText omits streak when CurrentStreak is 0
func TestFormatSessionText_NoStreakZero(t *testing.T) {
	streak := 0
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, &streak)

	result := FormatSessionText(data)

	if contains(result, "🔥") {
		t.Errorf("should not include streak emoji when CurrentStreak is 0")
	}
	if contains(result, "day streak") {
		t.Errorf("should not include streak text when CurrentStreak is 0")
	}
}

// Test FormatStatsText with complete stats
func TestFormatStatsText_Complete(t *testing.T) {
	bestTime := float64(102000) // 1:42
	avgTime := float64(151000)  // 2:31
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "claim123",
		BestTime:      &bestTime,
		AverageTime:   &avgTime,
		RecentSolves:  []api.RecentSolve{},
		WinRate:       0.9047619, // 38/42
		GamesPlayed:   42,
		GamesSolved:   38,
		CurrentStreak: 12,
		BestStreak:    18,
	}

	result := FormatStatsText(stats)

	if !contains(result, "UNQUOTE Stats") {
		t.Errorf("missing header")
	}
	if !contains(result, "42 played") {
		t.Errorf("missing games played")
	}
	if !contains(result, "38 solved") {
		t.Errorf("missing games solved")
	}
	if !contains(result, "90%") {
		t.Errorf("missing win rate percentage (expected ~90%%)")
	}
	if !contains(result, "12-day streak") {
		t.Errorf("missing current streak")
	}
	if !contains(result, "best: 18") {
		t.Errorf("missing best streak")
	}
	if !contains(result, "1:42") {
		t.Errorf("missing best time")
	}
	if !contains(result, "2:31") {
		t.Errorf("missing average time")
	}
	if !contains(result, "playunquote.com") {
		t.Errorf("missing footer URL")
	}
}

// Test FormatStatsText with no solves
func TestFormatStatsText_NoSolves(t *testing.T) {
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "claim123",
		BestTime:      nil,
		AverageTime:   nil,
		RecentSolves:  []api.RecentSolve{},
		WinRate:       0.0,
		GamesPlayed:   5,
		GamesSolved:   0,
		CurrentStreak: 0,
		BestStreak:    0,
	}

	result := FormatStatsText(stats)

	if !contains(result, "No solves yet") {
		t.Errorf("should show 'No solves yet' when BestTime and AverageTime are nil")
	}
}

// Test BuildLetterGrid with solved cells
func TestBuildLetterGrid_SolvedCells(t *testing.T) {
	cells := puzzle.BuildCells("ABC", nil)
	// All cells have Input set to 0, so all should be white
	for i := range cells {
		if cells[i].Kind == puzzle.CellLetter {
			cells[i].Input = 'A' + rune(i) // Give them input
		}
	}

	result := BuildLetterGrid(cells)

	// Expect 3 gold squares (one for each letter)
	goldCount := countSubstring(result, "🟨")
	if goldCount != 3 {
		t.Errorf("expected 3 gold squares, got %d", goldCount)
	}
}

// Test BuildLetterGrid with unsolved cells
func TestBuildLetterGrid_UnsolvedCells(t *testing.T) {
	cells := puzzle.BuildCells("ABC", nil)
	// All cells have Input = 0, so all should be white

	result := BuildLetterGrid(cells)

	whiteCount := countSubstring(result, "⬜")
	if whiteCount != 3 {
		t.Errorf("expected 3 white squares, got %d", whiteCount)
	}
}

// Test BuildLetterGrid with mixed solved and unsolved
func TestBuildLetterGrid_Mixed(t *testing.T) {
	cells := puzzle.BuildCells("ABCD", nil)
	// Set input for first 2 cells
	for i := range cells {
		if cells[i].Kind == puzzle.CellLetter {
			if i < 2 {
				cells[i].Input = 'X'
			}
		}
	}

	result := BuildLetterGrid(cells)

	goldCount := countSubstring(result, "🟨")
	whiteCount := countSubstring(result, "⬜")
	if goldCount != 2 {
		t.Errorf("expected 2 gold squares, got %d", goldCount)
	}
	if whiteCount != 2 {
		t.Errorf("expected 2 white squares, got %d", whiteCount)
	}
}

// Test BuildLetterGrid with spaces
func TestBuildLetterGrid_WithSpaces(t *testing.T) {
	cells := puzzle.BuildCells("A B", nil)

	result := BuildLetterGrid(cells)

	// Should contain spaces between words
	if !contains(result, " ") {
		t.Errorf("should preserve spaces between words")
	}
}

// Test BuildLetterGrid with punctuation
func TestBuildLetterGrid_WithPunctuation(t *testing.T) {
	cells := puzzle.BuildCells("A,B.", nil)

	result := BuildLetterGrid(cells)

	// Punctuation (except spaces) should be omitted
	if contains(result, ",") || contains(result, ".") {
		t.Errorf("should omit punctuation from grid")
	}
}

// Test BuildLetterGrid with hint cells
func TestBuildLetterGrid_WithHints(t *testing.T) {
	hints := map[rune]rune{'A': 'X'}
	cells := puzzle.BuildCells("ABC", hints)

	result := BuildLetterGrid(cells)

	// First cell is a hint, so gold; other two are CellLetter without input, so white
	goldCount := countSubstring(result, "🟨")
	whiteCount := countSubstring(result, "⬜")
	if goldCount != 1 {
		t.Errorf("expected 1 gold square (hint), got %d", goldCount)
	}
	if whiteCount != 2 {
		t.Errorf("expected 2 white squares, got %d", whiteCount)
	}
}

// Test BuildLetterGrid with empty cells
func TestBuildLetterGrid_Empty(t *testing.T) {
	result := BuildLetterGrid([]puzzle.Cell{})

	if result != "" {
		t.Errorf("expected empty string for empty cells, got %q", result)
	}
}

// Test fmtMs formatting (only when CompletionMs > 0, as that's when it's included)
func TestFmtMs_Various(t *testing.T) {
	testCases := []struct {
		expected string
		ms       int64
	}{
		{"0:05", 5000},
		{"1:00", 60000},
		{"2:08", 128000},
		{"2:31", 151000},
		{"61:01", 3661000},
	}

	for _, tc := range testCases {
		// Test via FormatSessionText which uses fmtMs
		data := newSessionData("2026-03-07", true, tc.ms, []puzzle.Cell{}, nil)

		result := FormatSessionText(data)

		if !contains(result, tc.expected) {
			t.Errorf("fmtMs(%d): expected %q in result, got %q", tc.ms, tc.expected, result)
		}
	}
}

// Helper functions
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func countSubstring(s, substr string) int {
	count := 0
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			count++
		}
	}
	return count
}
