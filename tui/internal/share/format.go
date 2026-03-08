package share

import (
	"fmt"
	"math"
	"strings"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

const wrapAt = 30

// SessionShareData holds the data needed to format a session result.
// nolint:govet // Field alignment warning is not applicable for this struct layout
type SessionShareData struct {
	Cells         []puzzle.Cell
	CompletionMs  int64  // completion time in milliseconds
	PuzzleNumber  string // e.g. "2026-03-07" — the puzzle date
	CurrentStreak *int   // nil for anonymous players
	Solved        bool
}

// fmtMs formats milliseconds as "M:SS" (no leading zero on minutes).
func fmtMs(ms int64) string {
	totalSec := ms / 1000
	m := totalSec / 60
	s := totalSec % 60
	return fmt.Sprintf("%d:%02d", m, s)
}

// BuildLetterGrid produces a Wordle-style emoji grid from a cell array.
//
// Gold square (🟨) for decoded letters (has input or is hint), white square (⬜)
// for undecoded letters. Spaces preserved, punctuation omitted.
// Lines wrap at word boundaries (~30 characters).
func BuildLetterGrid(cells []puzzle.Cell) string {
	gold := "\U0001F7E8" // 🟨
	white := "\u2B1C"    // ⬜

	var tokens []string
	for _, cell := range cells {
		switch cell.Kind {
		case puzzle.CellLetter:
			if cell.Input != 0 {
				tokens = append(tokens, gold)
			} else {
				tokens = append(tokens, white)
			}
		case puzzle.CellHint:
			tokens = append(tokens, gold)
		case puzzle.CellPunctuation:
			if cell.Char == ' ' {
				tokens = append(tokens, " ")
			}
			// Skip non-space punctuation
		}
	}

	// Join and wrap at word boundaries
	full := strings.Join(tokens, "")
	words := strings.Split(full, " ")
	var lines []string
	var current string

	for _, word := range words {
		switch {
		case current == "":
			current = word
		case len(current)+1+len(word) <= wrapAt:
			current += " " + word
		default:
			lines = append(lines, current)
			current = word
		}
	}
	if current != "" {
		lines = append(lines, current)
	}

	return strings.Join(lines, "\n")
}

// FormatSessionText produces a Wordle-style plain text session result.
//
// Example:
//
//	UNQUOTE #2026-03-07 ✅ 2:08
//
//	🟨⬜🟨 🟨⬜🟨⬜🟨
//	🟨⬜🟨🟨🟨 🟨⬜🟨
//
//	🔥 12-day streak
//	playunquote.com
func FormatSessionText(data SessionShareData) string {
	var status string
	if data.Solved {
		status = "\u2705" // ✅
	} else {
		status = "\u274C" // ❌
	}

	header := fmt.Sprintf("UNQUOTE #%s %s", data.PuzzleNumber, status)
	if data.Solved && data.CompletionMs > 0 {
		header += " " + fmtMs(data.CompletionMs)
	}

	grid := BuildLetterGrid(data.Cells)

	var parts []string
	parts = append(parts, header, "", grid)

	if data.CurrentStreak != nil && *data.CurrentStreak > 0 {
		parts = append(parts, "", fmt.Sprintf("\U0001F525 %d-day streak", *data.CurrentStreak))
	}

	parts = append(parts, "", "playunquote.com")

	return strings.Join(parts, "\n")
}

// FormatStatsText produces a Wordle-style plain text stats summary.
//
// Example:
//
//	UNQUOTE Stats
//
//	🎮 42 played · 38 solved · 90%
//	🔥 12-day streak (best: 18)
//	⏱️ Best 1:42 · Avg 2:31
//
//	playunquote.com
func FormatStatsText(stats *api.PlayerStatsResponse) string {
	pct := int(math.Round(stats.WinRate * 100))
	played := fmt.Sprintf("\U0001F3AE %d played \u00B7 %d solved \u00B7 %d%%",
		stats.GamesPlayed, stats.GamesSolved, pct)
	streak := fmt.Sprintf("\U0001F525 %d-day streak (best: %d)",
		stats.CurrentStreak, stats.BestStreak)

	var times string
	if stats.BestTime != nil && stats.AverageTime != nil {
		times = fmt.Sprintf("\u23F1\uFE0F Best %s \u00B7 Avg %s",
			fmtMs(int64(*stats.BestTime)), fmtMs(int64(*stats.AverageTime)))
	} else {
		times = "\u23F1\uFE0F No solves yet"
	}

	return strings.Join([]string{
		"UNQUOTE Stats",
		"",
		played,
		streak,
		times,
		"",
		"playunquote.com",
	}, "\n")
}
