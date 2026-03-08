package share

import (
	"bytes"
	"image/png"
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

// AC5.1: GenerateSessionCard returns an image with dimensions 1200x628
func TestGenerateSessionCard_AC5_1_Dimensions(t *testing.T) {
	data := SessionShareData{
		PuzzleNumber: "2026-03-07",
		Cells:        puzzle.BuildCells("ABC", nil),
		CompletionMs: 128000,
		Streak:       0,
		Solved:       true,
	}

	img := GenerateSessionCard(data)

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width != 1200 {
		t.Errorf("expected width 1200, got %d", width)
	}
	if height != 628 {
		t.Errorf("expected height 628, got %d", height)
	}
}

// AC5.2: GenerateStatsCard returns an image with dimensions 1200x628
func TestGenerateStatsCard_AC5_2_Dimensions(t *testing.T) {
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "TEST-CODE",
		GamesPlayed:   42,
		GamesSolved:   38,
		WinRate:       0.9047619,
		CurrentStreak: 12,
		BestStreak:    18,
		BestTime:      nil,
		AverageTime:   nil,
		RecentSolves:  []api.RecentSolve{},
	}

	img := GenerateStatsCard(stats)

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width != 1200 {
		t.Errorf("expected width 1200, got %d", width)
	}
	if height != 628 {
		t.Errorf("expected height 628, got %d", height)
	}
}

// AC5.3: GenerateSessionCard encodes to valid PNG
func TestGenerateSessionCard_AC5_3_ValidPNG(t *testing.T) {
	data := SessionShareData{
		PuzzleNumber: "2026-03-07",
		Cells:        puzzle.BuildCells("ABC", nil),
		CompletionMs: 128000,
		Streak:       0,
		Solved:       true,
	}

	img := GenerateSessionCard(data)

	// Encode to PNG
	var buf bytes.Buffer
	err := png.Encode(&buf, img)
	if err != nil {
		t.Errorf("failed to encode session card to PNG: %v", err)
		return
	}

	// Verify PNG can be decoded back
	decodedImg, err := png.Decode(bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Errorf("failed to decode PNG: %v", err)
		return
	}

	// Verify dimensions are preserved
	bounds := decodedImg.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("decoded image has wrong dimensions: %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// AC5.3: GenerateStatsCard encodes to valid PNG
func TestGenerateStatsCard_AC5_3_ValidPNG(t *testing.T) {
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "TEST-CODE",
		GamesPlayed:   42,
		GamesSolved:   38,
		WinRate:       0.9047619,
		CurrentStreak: 12,
		BestStreak:    18,
		BestTime:      nil,
		AverageTime:   nil,
		RecentSolves:  []api.RecentSolve{},
	}

	img := GenerateStatsCard(stats)

	// Encode to PNG
	var buf bytes.Buffer
	err := png.Encode(&buf, img)
	if err != nil {
		t.Errorf("failed to encode stats card to PNG: %v", err)
		return
	}

	// Verify PNG can be decoded back
	decodedImg, err := png.Decode(bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Errorf("failed to decode PNG: %v", err)
		return
	}

	// Verify dimensions are preserved
	bounds := decodedImg.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("decoded image has wrong dimensions: %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// AC5.1: GenerateSessionCard with zero completion time still produces valid image
func TestGenerateSessionCard_ZeroCompletionTime(t *testing.T) {
	data := SessionShareData{
		PuzzleNumber: "2026-03-07",
		Cells:        puzzle.BuildCells("ABC", nil),
		CompletionMs: 0,
		Streak:       0,
		Solved:       false,
	}

	img := GenerateSessionCard(data)

	if img == nil {
		t.Errorf("GenerateSessionCard returned nil image")
		return
	}

	bounds := img.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("expected 1200x628, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// AC5.2: GenerateStatsCard with nil BestTime/AverageTime still produces valid image
func TestGenerateStatsCard_NilTimes(t *testing.T) {
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "TEST-CODE",
		GamesPlayed:   5,
		GamesSolved:   0,
		WinRate:       0.0,
		CurrentStreak: 0,
		BestStreak:    0,
		BestTime:      nil,
		AverageTime:   nil,
		RecentSolves:  []api.RecentSolve{},
	}

	img := GenerateStatsCard(stats)

	if img == nil {
		t.Errorf("GenerateStatsCard returned nil image")
		return
	}

	bounds := img.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("expected 1200x628, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// AC5.1: GenerateSessionCard with nil streak still produces valid image
func TestGenerateSessionCard_NilStreak(t *testing.T) {
	data := SessionShareData{
		PuzzleNumber: "2026-03-07",
		Cells:        puzzle.BuildCells("ABC", nil),
		CompletionMs: 128000,
		Streak:       0, // Zero streak means no streak badge
		Solved:       true,
	}

	img := GenerateSessionCard(data)

	if img == nil {
		t.Errorf("GenerateSessionCard returned nil image")
		return
	}

	bounds := img.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("expected 1200x628, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// Test PNG encode/decode round-trip for session card
func TestGenerateSessionCard_RoundTripPNG(t *testing.T) {
	data := SessionShareData{
		PuzzleNumber: "2026-03-07",
		Cells:        puzzle.BuildCells("The quick brown fox jumps over the lazy dog", nil),
		CompletionMs: 245000,
		Streak:       5,
		Solved:       true,
	}

	origImg := GenerateSessionCard(data)

	// Encode and decode
	var buf bytes.Buffer
	err := png.Encode(&buf, origImg)
	if err != nil {
		t.Errorf("encode failed: %v", err)
		return
	}

	decodedImg, err := png.Decode(bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Errorf("decode failed: %v", err)
		return
	}

	// Verify it's an image.Image
	if decodedImg == nil {
		t.Errorf("decoded image is nil")
		return
	}

	bounds := decodedImg.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("round-trip failed: dimensions %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// Test PNG encode/decode round-trip for stats card
func TestGenerateStatsCard_RoundTripPNG(t *testing.T) {
	bestTime := float64(102000) // 1:42
	avgTime := float64(151000)  // 2:31
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "TEST-CODE",
		GamesPlayed:   42,
		GamesSolved:   38,
		WinRate:       0.9047619,
		CurrentStreak: 12,
		BestStreak:    18,
		BestTime:      &bestTime,
		AverageTime:   &avgTime,
		RecentSolves: []api.RecentSolve{
			{Date: "2026-03-01", CompletionTime: 120000},
			{Date: "2026-03-02", CompletionTime: 150000},
			{Date: "2026-03-03", CompletionTime: 135000},
		},
	}

	origImg := GenerateStatsCard(stats)

	// Encode and decode
	var buf bytes.Buffer
	err := png.Encode(&buf, origImg)
	if err != nil {
		t.Errorf("encode failed: %v", err)
		return
	}

	decodedImg, err := png.Decode(bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Errorf("decode failed: %v", err)
		return
	}

	// Verify it's an image.Image
	if decodedImg == nil {
		t.Errorf("decoded image is nil")
		return
	}

	bounds := decodedImg.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("round-trip failed: dimensions %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// Test GenerateSessionCard with large completion time
func TestGenerateSessionCard_LargeCompletionTime(t *testing.T) {
	data := SessionShareData{
		PuzzleNumber: "2026-03-07",
		Cells:        puzzle.BuildCells("ABC", nil),
		CompletionMs: 3661000, // 61:01
		Streak:       0,
		Solved:       true,
	}

	img := GenerateSessionCard(data)

	if img == nil {
		t.Errorf("GenerateSessionCard returned nil image for large time")
		return
	}

	bounds := img.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("expected 1200x628, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// Test GenerateStatsCard with high streak
func TestGenerateStatsCard_HighStreak(t *testing.T) {
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "TEST-CODE",
		GamesPlayed:   100,
		GamesSolved:   99,
		WinRate:       0.99,
		CurrentStreak: 99,
		BestStreak:    99,
		BestTime:      nil,
		AverageTime:   nil,
		RecentSolves:  []api.RecentSolve{},
	}

	img := GenerateStatsCard(stats)

	if img == nil {
		t.Errorf("GenerateStatsCard returned nil image for high streak")
		return
	}

	bounds := img.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("expected 1200x628, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// Test GenerateSessionCard with empty cells
func TestGenerateSessionCard_EmptyCells(t *testing.T) {
	data := SessionShareData{
		PuzzleNumber: "2026-03-07",
		Cells:        []puzzle.Cell{},
		CompletionMs: 128000,
		Streak:       0,
		Solved:       true,
	}

	img := GenerateSessionCard(data)

	if img == nil {
		t.Errorf("GenerateSessionCard returned nil image for empty cells")
		return
	}

	bounds := img.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("expected 1200x628, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

// AC5.2: GenerateStatsCard with single recent solve produces valid PNG (edge case)
func TestGenerateStatsCard_SingleRecentSolve(t *testing.T) {
	bestTime := float64(102000) // 1:42
	avgTime := float64(102000)  // Same as best
	stats := &api.PlayerStatsResponse{
		ClaimCode:     "TEST-CODE",
		GamesPlayed:   1,
		GamesSolved:   1,
		WinRate:       1.0,
		CurrentStreak: 1,
		BestStreak:    1,
		BestTime:      &bestTime,
		AverageTime:   &avgTime,
		RecentSolves: []api.RecentSolve{
			{Date: "2026-03-08", CompletionTime: 102000},
		},
	}

	img := GenerateStatsCard(stats)

	if img == nil {
		t.Errorf("GenerateStatsCard returned nil image for single recent solve")
		return
	}

	// Encode to PNG to verify it's a valid image
	var buf bytes.Buffer
	err := png.Encode(&buf, img)
	if err != nil {
		t.Errorf("failed to encode stats card to PNG: %v", err)
		return
	}

	// Verify PNG can be decoded back
	decodedImg, err := png.Decode(bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Errorf("failed to decode PNG: %v", err)
		return
	}

	// Verify dimensions are correct (1200x628)
	bounds := decodedImg.Bounds()
	if bounds.Dx() != 1200 || bounds.Dy() != 628 {
		t.Errorf("expected 1200x628, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}
