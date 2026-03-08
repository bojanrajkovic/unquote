package share

import (
	"image"
	"strconv"

	"github.com/fogleman/gg"
	"github.com/golang/freetype/truetype"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/share/fonts"
)

// Color palette (matching web app.css)
const (
	colorSurface     = "#0c0c18" // dark navy background
	colorGold        = "#d4a140" // stat values, wordmark
	colorGoldBright  = "#e8bb60" // highlights
	colorGoldDim     = "#5a3e0e" // borders
	colorTextPrimary = "#eae0ca" // warm off-white
	colorTextMuted   = "#8a8aa4" // labels
	colorTeal        = "#7dd4e8" // sparkline
)

// Package-level fonts parsed once at init time to avoid repeated parsing
var (
	fontSpaceMonoRegular      *truetype.Font
	fontSpaceMonoBold         *truetype.Font
	fontCormorantGaramondSemi *truetype.Font
)

func init() {
	var err error
	fontSpaceMonoRegular, err = truetype.Parse(fonts.SpaceMonoRegular)
	if err != nil {
		panic("failed to parse SpaceMonoRegular font: " + err.Error())
	}
	fontSpaceMonoBold, err = truetype.Parse(fonts.SpaceMonoBold)
	if err != nil {
		panic("failed to parse SpaceMonoBold font: " + err.Error())
	}
	fontCormorantGaramondSemi, err = truetype.Parse(fonts.CormorantGaramondSemiBold)
	if err != nil {
		panic("failed to parse CormorantGaramondSemiBold font: " + err.Error())
	}
}

// newCardContext creates a 1200x628 context with navy background.
func newCardContext() *gg.Context {
	dc := gg.NewContext(1200, 628)
	dc.SetHexColor(colorSurface)
	dc.Clear()
	return dc
}

// drawWordmark draws the UNQUOTE wordmark in the top-left.
func drawWordmark(dc *gg.Context) {
	face := truetype.NewFace(fontSpaceMonoBold, &truetype.Options{Size: 28})
	dc.SetFontFace(face)
	dc.SetHexColor(colorGold)
	dc.DrawString("UNQUOTE", 48, 52)
}

// drawFooter draws the playunquote.com footer centered at the bottom.
func drawFooter(dc *gg.Context) {
	face := truetype.NewFace(fontSpaceMonoRegular, &truetype.Options{Size: 16})
	dc.SetFontFace(face)
	dc.SetHexColor(colorTextMuted)
	dc.DrawStringAnchored("playunquote.com", 600, 604, 0.5, 0.5)
}

// GenerateSessionCard generates a branded PNG card for a session share.
func GenerateSessionCard(data SessionShareData) image.Image {
	dc := newCardContext()

	// Top: Wordmark
	drawWordmark(dc)

	// Top-right: puzzle date (muted)
	face := truetype.NewFace(fontSpaceMonoRegular, &truetype.Options{Size: 16})
	dc.SetFontFace(face)
	dc.SetHexColor(colorTextMuted)
	dc.DrawStringAnchored(data.PuzzleNumber, 1152, 40, 1.0, 0.0)

	// Center: Status + Time
	// Status: "SOLVED" or "UNSOLVED" in Cormorant Garamond (64pt)
	face = truetype.NewFace(fontCormorantGaramondSemi, &truetype.Options{Size: 64})
	dc.SetFontFace(face)
	dc.SetHexColor(colorGold)

	var status string
	if data.Solved {
		status = "SOLVED"
	} else {
		status = "UNSOLVED"
	}
	dc.DrawStringAnchored(status, 600, 200, 0.5, 0.5)

	// Time below status (Space Mono Bold, 72pt)
	face = truetype.NewFace(fontSpaceMonoBold, &truetype.Options{Size: 72})
	dc.SetFontFace(face)

	timeStr := fmtMs(data.CompletionMs)
	dc.DrawStringAnchored(timeStr, 600, 320, 0.5, 0.5)

	// Bottom-left: Letter grid (small colored rectangles)
	drawLetterGrid(dc, data.Cells)

	// Bottom-right: Streak badge (if available)
	if data.Streak > 0 {
		drawStreakBadge(dc, data.Streak)
	}

	// Footer
	drawFooter(dc)

	return dc.Image()
}

// drawLetterGrid draws a small colored letter grid in the bottom-left area.
func drawLetterGrid(dc *gg.Context, cells []puzzle.Cell) {
	cellSize := 12
	padding := 48
	spacing := 2
	startX := float64(padding)
	startY := float64(420)

	col := 0
	row := 0
	maxCols := 15

	for _, cell := range cells {
		var shouldDraw bool
		var color string

		switch cell.Kind {
		case puzzle.CellLetter:
			shouldDraw = true
			if cell.Input != 0 {
				color = colorGold
			} else {
				color = colorTextMuted
			}
		case puzzle.CellHint:
			shouldDraw = true
			color = colorGold
		case puzzle.CellPunctuation:
			// Space: new line
			if cell.Char == ' ' {
				col = 0
				row++
			}
			continue
		}

		if shouldDraw {
			x := startX + float64(col)*(float64(cellSize)+float64(spacing))
			y := startY + float64(row)*(float64(cellSize)+float64(spacing))

			dc.SetHexColor(color)
			dc.DrawRectangle(x, y, float64(cellSize), float64(cellSize))
			dc.Fill()

			col++
			if col >= maxCols {
				col = 0
				row++
			}
		}
	}
}

// drawStreakBadge draws a streak badge in the bottom-right.
func drawStreakBadge(dc *gg.Context, streak int) {
	// Simple badge background
	dc.SetHexColor(colorGoldDim)
	dc.DrawRectangle(950, 420, 200, 140)
	dc.Fill()

	// Streak label
	face := truetype.NewFace(fontSpaceMonoRegular, &truetype.Options{Size: 12})
	dc.SetFontFace(face)
	dc.SetHexColor(colorTextMuted)
	dc.DrawStringAnchored("STREAK", 1050, 440, 0.5, 0.0)

	// Streak count
	face = truetype.NewFace(fontSpaceMonoBold, &truetype.Options{Size: 48})
	dc.SetFontFace(face)
	dc.SetHexColor(colorGold)
	streakStr := fmtInt(streak)
	dc.DrawStringAnchored(streakStr, 1050, 520, 0.5, 0.5)
}

// fmtInt formats a non-negative integer as a string, clamping negative values to 0.
func fmtInt(n int) string {
	if n < 0 {
		n = 0
	}
	return strconv.Itoa(n)
}

// GenerateStatsCard generates a branded PNG card for stats share.
func GenerateStatsCard(stats *api.PlayerStatsResponse) image.Image {
	dc := newCardContext()

	// Top: Wordmark
	drawWordmark(dc)

	// Top-right: "PLAYER STATS"
	face := truetype.NewFace(fontSpaceMonoRegular, &truetype.Options{Size: 16})
	dc.SetFontFace(face)
	dc.SetHexColor(colorTextMuted)
	dc.DrawStringAnchored("PLAYER STATS", 1152, 40, 1.0, 0.0)

	// Center: 2x2 grid of stat tiles
	drawStatsTiles(dc, stats)

	// Bottom: Best time + average time
	drawTimesLine(dc, stats)

	// Sparkline (teal stroke)
	drawSparkline(dc, stats)

	// Footer
	drawFooter(dc)

	return dc.Image()
}

// drawStatsTiles draws a 2x2 grid of stat tiles in the center.
func drawStatsTiles(dc *gg.Context, stats *api.PlayerStatsResponse) {
	tiles := []struct {
		label string
		value string
		row   int
		col   int
	}{
		{"PLAYED", fmtInt(stats.GamesPlayed), 0, 0},
		{"SOLVED", fmtInt(stats.GamesSolved), 0, 1},
		{"WIN RATE", fmtPercent(stats.WinRate), 1, 0},
		{"STREAK", fmtInt(stats.CurrentStreak), 1, 1},
	}

	tileWidth := 260.0
	tileHeight := 110.0
	startX := 200.0
	startY := 180.0
	gapX := 280.0
	gapY := 140.0

	for _, tile := range tiles {
		x := startX + float64(tile.col)*gapX
		y := startY + float64(tile.row)*gapY

		// Tile background
		dc.SetHexColor(colorGoldDim)
		dc.DrawRectangle(x, y, tileWidth, tileHeight)
		dc.Fill()

		// Tile border
		dc.SetHexColor(colorGold)
		dc.SetLineWidth(2)
		dc.DrawRectangle(x, y, tileWidth, tileHeight)
		dc.Stroke()

		// Label (muted, small)
		face := truetype.NewFace(fontSpaceMonoRegular, &truetype.Options{Size: 12})
		dc.SetFontFace(face)
		dc.SetHexColor(colorTextMuted)
		dc.DrawStringAnchored(tile.label, x+tileWidth/2, y+25, 0.5, 0.5)

		// Value (gold, large)
		face = truetype.NewFace(fontSpaceMonoBold, &truetype.Options{Size: 36})
		dc.SetFontFace(face)
		dc.SetHexColor(colorGold)
		dc.DrawStringAnchored(tile.value, x+tileWidth/2, y+70, 0.5, 0.5)
	}
}

// fmtPercent formats a win rate (0.0-1.0) as a percentage string.
func fmtPercent(rate float64) string {
	pct := int(rate * 100)
	return fmtInt(pct) + "%"
}

// drawTimesLine draws the best time and average time at the bottom-center.
func drawTimesLine(dc *gg.Context, stats *api.PlayerStatsResponse) {
	face := truetype.NewFace(fontSpaceMonoRegular, &truetype.Options{Size: 14})
	dc.SetFontFace(face)
	dc.SetHexColor(colorTextMuted)

	var timeStr string
	if stats.BestTime != nil && stats.AverageTime != nil {
		bestStr := fmtMs(int64(*stats.BestTime))
		avgStr := fmtMs(int64(*stats.AverageTime))
		timeStr = "Best " + bestStr + " · Avg " + avgStr
	} else {
		timeStr = "No solves yet"
	}

	dc.DrawStringAnchored(timeStr, 600, 380, 0.5, 0.5)
}

// drawSparkline draws a simple sparkline using horizontal lines (teal stroke).
func drawSparkline(dc *gg.Context, stats *api.PlayerStatsResponse) {
	if len(stats.RecentSolves) == 0 {
		return
	}

	numSolves := len(stats.RecentSolves)
	if numSolves > 20 {
		numSolves = 20 // Limit to last 20
	}

	// For a single solve, just draw a dot at center instead of attempting line connection
	if numSolves <= 1 {
		startX := 350.0
		startY := 450.0
		width := 500.0
		height := 80.0
		dc.SetHexColor(colorTeal)
		dc.SetLineWidth(2)
		dc.DrawCircle(startX+width/2, startY+height/2, 3)
		dc.Fill()
		return
	}

	// Simple sparkline: connect recent solve times with lines
	startX := 350.0
	startY := 450.0
	width := 500.0
	height := 80.0

	recentSolves := stats.RecentSolves
	if len(recentSolves) > numSolves {
		recentSolves = recentSolves[:numSolves]
	}

	// Find min/max times
	var minTime, maxTime float64 = 1e9, 0
	for _, solve := range recentSolves {
		if solve.CompletionTime < minTime {
			minTime = solve.CompletionTime
		}
		if solve.CompletionTime > maxTime {
			maxTime = solve.CompletionTime
		}
	}

	if maxTime == minTime {
		maxTime = minTime + 1 // Avoid division by zero
	}

	dc.SetHexColor(colorTeal)
	dc.SetLineWidth(2)

	for i, solve := range recentSolves {
		// Normalize time to height
		normalized := (solve.CompletionTime - minTime) / (maxTime - minTime)
		y := startY + height - normalized*height

		x := startX + (float64(i)/float64(numSolves-1))*width
		if i == 0 {
			dc.MoveTo(x, y)
		} else {
			dc.LineTo(x, y)
		}
	}

	dc.Stroke()
}
