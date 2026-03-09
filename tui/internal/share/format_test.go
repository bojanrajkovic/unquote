package share

import (
	"strings"
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

// Helper to create SessionShareData without field alignment issues
func newSessionData(puzzleNum string, solved bool, completionMs int64, cells []puzzle.Cell, streak *int) SessionShareData {
	streakInt := 0
	if streak != nil {
		streakInt = *streak
	}
	return SessionShareData{
		Cells:        cells,
		PuzzleNumber: puzzleNum,
		CompletionMs: completionMs,
		Streak:       streakInt,
		Solved:       solved,
	}
}

// AC3.1: FormatSessionText produces correct header with puzzle number, status emoji, and completion time
func TestFormatSessionText_AC3_1_SolvedHeader(t *testing.T) {
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if !strings.Contains(result, "UNQUOTE #2026-03-07") {
		t.Errorf("missing puzzle number in header")
	}
	if !strings.Contains(result, "✅") {
		t.Errorf("missing solved emoji in header")
	}
	if !strings.Contains(result, "2:08") {
		t.Errorf("missing completion time in header")
	}
}

// AC3.1: FormatSessionText shows cross mark emoji for unsolved puzzles
func TestFormatSessionText_AC3_1_UnsolvedHeader(t *testing.T) {
	data := newSessionData("2026-03-07", false, 0, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if !strings.Contains(result, "UNQUOTE #2026-03-07") {
		t.Errorf("missing puzzle number in header")
	}
	if !strings.Contains(result, "❌") {
		t.Errorf("missing unsolved emoji in header")
	}
}

// AC3.1: FormatSessionText includes footer URL in output
func TestFormatSessionText_AC3_1_Footer(t *testing.T) {
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if !strings.Contains(result, "playunquote.com") {
		t.Errorf("missing footer URL")
	}
}

// AC3.1: FormatSessionText includes streak when CurrentStreak is set and > 0
func TestFormatSessionText_AC3_1_WithStreak(t *testing.T) {
	streak := 12
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, &streak)

	result := FormatSessionText(data)

	if !strings.Contains(result, "🔥") {
		t.Errorf("missing streak emoji")
	}
	if !strings.Contains(result, "12-day streak") {
		t.Errorf("missing streak text")
	}
}

// AC3.4: FormatSessionText omits streak line when CurrentStreak is nil
func TestFormatSessionText_AC3_4_NoStreakNil(t *testing.T) {
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, nil)

	result := FormatSessionText(data)

	if strings.Contains(result, "🔥") {
		t.Errorf("should not include streak emoji when CurrentStreak is nil")
	}
	if strings.Contains(result, "day streak") {
		t.Errorf("should not include streak text when CurrentStreak is nil")
	}
}

// AC3.4: FormatSessionText omits streak line when CurrentStreak is 0
func TestFormatSessionText_AC3_4_NoStreakZero(t *testing.T) {
	streak := 0
	data := newSessionData("2026-03-07", true, 128000, []puzzle.Cell{}, &streak)

	result := FormatSessionText(data)

	if strings.Contains(result, "🔥") {
		t.Errorf("should not include streak emoji when CurrentStreak is 0")
	}
	if strings.Contains(result, "day streak") {
		t.Errorf("should not include streak text when CurrentStreak is 0")
	}
}

// AC4.1: FormatStatsText produces correct output with games, streaks, and times
func TestFormatStatsText_AC4_1_Complete(t *testing.T) {
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

	if !strings.Contains(result, "UNQUOTE Stats") {
		t.Errorf("missing header")
	}
	if !strings.Contains(result, "42 played") {
		t.Errorf("missing games played")
	}
	if !strings.Contains(result, "38 solved") {
		t.Errorf("missing games solved")
	}
	if !strings.Contains(result, "90%") {
		t.Errorf("missing win rate percentage (expected ~90%%)")
	}
	if !strings.Contains(result, "12-day streak") {
		t.Errorf("missing current streak")
	}
	if !strings.Contains(result, "best: 18") {
		t.Errorf("missing best streak")
	}
	if !strings.Contains(result, "1:42") {
		t.Errorf("missing best time")
	}
	if !strings.Contains(result, "2:31") {
		t.Errorf("missing average time")
	}
	if !strings.Contains(result, "playunquote.com") {
		t.Errorf("missing footer URL")
	}
}

// AC4.1: FormatStatsText handles nil BestTime and AverageTime with "No solves yet"
func TestFormatStatsText_AC4_1_NoSolves(t *testing.T) {
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

	if !strings.Contains(result, "No solves yet") {
		t.Errorf("should show 'No solves yet' when BestTime and AverageTime are nil")
	}
}

// AC3.1: BuildLetterGrid maps CellLetter with input to gold squares
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
	goldCount := strings.Count(result, "🟨")
	if goldCount != 3 {
		t.Errorf("expected 3 gold squares, got %d", goldCount)
	}
}

// AC3.1: BuildLetterGrid maps CellLetter without input to white squares
func TestBuildLetterGrid_UnsolvedCells(t *testing.T) {
	cells := puzzle.BuildCells("ABC", nil)
	// All cells have Input = 0, so all should be white

	result := BuildLetterGrid(cells)

	whiteCount := strings.Count(result, "⬜")
	if whiteCount != 3 {
		t.Errorf("expected 3 white squares, got %d", whiteCount)
	}
}

// AC3.1: BuildLetterGrid with mixed solved and unsolved cells
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

	goldCount := strings.Count(result, "🟨")
	whiteCount := strings.Count(result, "⬜")
	if goldCount != 2 {
		t.Errorf("expected 2 gold squares, got %d", goldCount)
	}
	if whiteCount != 2 {
		t.Errorf("expected 2 white squares, got %d", whiteCount)
	}
}

// AC3.1: BuildLetterGrid preserves space CellPunctuation
func TestBuildLetterGrid_WithSpaces(t *testing.T) {
	cells := puzzle.BuildCells("A B", nil)

	result := BuildLetterGrid(cells)

	// Should contain spaces between words
	if !strings.Contains(result, " ") {
		t.Errorf("should preserve spaces between words")
	}
}

// AC3.1: BuildLetterGrid omits non-space punctuation
func TestBuildLetterGrid_WithPunctuation(t *testing.T) {
	cells := puzzle.BuildCells("A,B.", nil)

	result := BuildLetterGrid(cells)

	// Punctuation (except spaces) should be omitted
	if strings.Contains(result, ",") || strings.Contains(result, ".") {
		t.Errorf("should omit punctuation from grid")
	}
}

// AC3.1: BuildLetterGrid maps CellHint to gold squares
func TestBuildLetterGrid_WithHints(t *testing.T) {
	hints := map[rune]rune{'A': 'X'}
	cells := puzzle.BuildCells("ABC", hints)

	result := BuildLetterGrid(cells)

	// First cell is a hint, so gold; other two are CellLetter without input, so white
	goldCount := strings.Count(result, "🟨")
	whiteCount := strings.Count(result, "⬜")
	if goldCount != 1 {
		t.Errorf("expected 1 gold square (hint), got %d", goldCount)
	}
	if whiteCount != 2 {
		t.Errorf("expected 2 white squares, got %d", whiteCount)
	}
}

// AC3.1: BuildLetterGrid returns empty string for empty cells
func TestBuildLetterGrid_Empty(t *testing.T) {
	result := BuildLetterGrid([]puzzle.Cell{})

	if result != "" {
		t.Errorf("expected empty string for empty cells, got %q", result)
	}
}

// AC3.1: fmtMs formats various millisecond values correctly
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

		if !strings.Contains(result, tc.expected) {
			t.Errorf("fmtMs(%d): expected %q in result, got %q", tc.ms, tc.expected, result)
		}
	}
}
