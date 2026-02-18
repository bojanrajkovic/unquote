package app

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
)

// sampleStats returns a populated PlayerStatsResponse for testing.
func sampleStats() *api.PlayerStatsResponse {
	bestTime := 128000.0   // 2:08
	avgTime := 195000.0    // 3:15
	return &api.PlayerStatsResponse{
		ClaimCode:     "TIGER-MAPLE-7492",
		GamesPlayed:   42,
		GamesSolved:   40,
		WinRate:       0.957,
		CurrentStreak: 5,
		BestStreak:    12,
		BestTime:      &bestTime,
		AverageTime:   &avgTime,
		RecentSolves: []api.RecentSolve{
			{Date: "2026-02-15", CompletionTime: 128000},
			{Date: "2026-02-14", CompletionTime: 195000},
			{Date: "2026-02-13", CompletionTime: 210000},
		},
	}
}

// statsModel creates a Model in StateStats with the given stats data.
func statsModel(stats *api.PlayerStatsResponse, statsOnly bool) Model {
	m := Model{
		state:     StateStats,
		stats:     stats,
		statsOnly: statsOnly,
		width:     120,
		height:    40,
		sizeReady: true,
	}
	return m
}

// TestFormatMs verifies millisecond-to-M:SS formatting.
func TestFormatMs(t *testing.T) {
	tests := []struct {
		name     string
		ms       float64
		expected string
	}{
		{"zero", 0, "0:00"},
		{"one minute", 60000, "1:00"},
		{"2:08", 128000, "2:08"},
		{"3:15", 195000, "3:15"},
		{"10:00", 600000, "10:00"},
		{"partial seconds truncated", 128500, "2:08"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatMs(tt.ms)
			if got != tt.expected {
				t.Errorf("formatMs(%v) = %q, want %q", tt.ms, got, tt.expected)
			}
		})
	}
}

// TestViewStats_ContainsSidebarLabels verifies the stats view renders sidebar labels.
func TestViewStats_ContainsSidebarLabels(t *testing.T) {
	m := statsModel(sampleStats(), false)
	view := m.viewStats()

	labels := []string{"Games Played", "Games Solved", "Win Rate", "Current Streak", "Best Streak", "Best Time", "Avg Time"}
	for _, label := range labels {
		if !strings.Contains(view, label) {
			t.Errorf("viewStats() missing sidebar label %q", label)
		}
	}
}

// TestViewStats_ContainsFormattedValues verifies the stats view renders formatted values.
func TestViewStats_ContainsFormattedValues(t *testing.T) {
	m := statsModel(sampleStats(), false)
	view := m.viewStats()

	// Win rate should appear as 95.7%
	if !strings.Contains(view, "95.7%") {
		t.Errorf("viewStats() missing win rate '95.7%%', got view of length %d", len(view))
	}

	// Best time 128000ms → 2:08
	if !strings.Contains(view, "2:08") {
		t.Errorf("viewStats() missing best time '2:08'")
	}

	// Avg time 195000ms → 3:15
	if !strings.Contains(view, "3:15") {
		t.Errorf("viewStats() missing avg time '3:15'")
	}
}

// TestViewStats_ContainsGraphCharacters verifies the graph is rendered when solves exist.
func TestViewStats_ContainsGraphCharacters(t *testing.T) {
	m := statsModel(sampleStats(), false)
	view := m.viewStats()

	// asciigraph renders box-drawing characters like ┤ or the axis labels
	graphChars := []string{"┤", "Solve Times"}
	found := false
	for _, ch := range graphChars {
		if strings.Contains(view, ch) {
			found = true
			break
		}
	}
	if !found {
		t.Error("viewStats() does not appear to contain asciigraph output")
	}
}

// TestViewStats_NilBestTime verifies nil BestTime renders as "—".
func TestViewStats_NilBestTime(t *testing.T) {
	stats := sampleStats()
	stats.BestTime = nil
	stats.AverageTime = nil
	m := statsModel(stats, false)
	view := m.viewStats()

	if !strings.Contains(view, "—") {
		t.Errorf("viewStats() with nil BestTime should show '—', view missing it")
	}
}

// TestViewStats_EmptyRecentSolves verifies no-data message when no solves.
func TestViewStats_EmptyRecentSolves(t *testing.T) {
	stats := sampleStats()
	stats.RecentSolves = nil
	m := statsModel(stats, false)
	view := m.viewStats()

	if !strings.Contains(view, "No solve history") {
		t.Errorf("viewStats() with empty solves should show 'No solve history', got: %q", view[:min(200, len(view))])
	}
}

// TestViewStats_NilStats verifies error message when stats is nil.
func TestViewStats_NilStats(t *testing.T) {
	m := statsModel(nil, false)
	view := m.viewStats()

	if !strings.Contains(view, "Failed to load stats") {
		t.Errorf("viewStats() with nil stats should show error, got: %q", view)
	}
}

// TestViewStats_HelpBar_StatsOnly verifies the help bar shows [Esc] Quit in stats-only mode.
func TestViewStats_HelpBar_StatsOnly(t *testing.T) {
	m := statsModel(sampleStats(), true)
	view := m.viewStats()

	if !strings.Contains(view, "[Esc] Quit") {
		t.Errorf("viewStats() statsOnly=true should show '[Esc] Quit'")
	}
}

// TestViewStats_HelpBar_NotStatsOnly verifies the help bar shows [Esc] Back when not stats-only.
func TestViewStats_HelpBar_NotStatsOnly(t *testing.T) {
	m := statsModel(sampleStats(), false)
	view := m.viewStats()

	if !strings.Contains(view, "[Esc] Back") {
		t.Errorf("viewStats() statsOnly=false should show '[Esc] Back'")
	}
}

// TestHandleKeyMsg_StatsSolved_SKeyFetchesStats verifies 's' on solved screen triggers stats fetch.
func TestHandleKeyMsg_StatsSolved_SKeyFetchesStats(t *testing.T) {
	m := Model{
		state:     StateSolved,
		claimCode: "TIGER-MAPLE-7492",
		sizeReady: true,
		width:     120,
		height:    40,
	}

	model, cmd := m.handleKeyMsg(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'s'}})
	result := model.(Model)

	if result.state != StateLoading {
		t.Errorf("expected StateLoading after 's' on StateSolved, got %v", result.state)
	}
	if cmd == nil {
		t.Error("expected non-nil cmd (fetchStatsCmd) after 's' on StateSolved")
	}
}

// TestHandleKeyMsg_StatsSolved_SKeyNoClaimCode verifies 's' without claim code does nothing.
func TestHandleKeyMsg_StatsSolved_SKeyNoClaimCode(t *testing.T) {
	m := Model{
		state:     StateSolved,
		claimCode: "",
		sizeReady: true,
		width:     120,
		height:    40,
	}

	model, cmd := m.handleKeyMsg(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'s'}})
	result := model.(Model)

	if result.state != StateSolved {
		t.Errorf("expected StateSolved unchanged, got %v", result.state)
	}
	if cmd != nil {
		t.Error("expected nil cmd when no claim code")
	}
}

// TestHandleKeyMsg_StateStats_EscNotStatsOnly verifies Esc on stats screen returns to solved.
func TestHandleKeyMsg_StateStats_EscNotStatsOnly(t *testing.T) {
	m := Model{
		state:     StateStats,
		statsOnly: false,
		sizeReady: true,
	}

	model, cmd := m.handleKeyMsg(tea.KeyMsg{Type: tea.KeyEsc})
	result := model.(Model)

	if result.state != StateSolved {
		t.Errorf("expected StateSolved after Esc on stats (statsOnly=false), got %v", result.state)
	}
	if cmd != nil {
		t.Error("expected nil cmd")
	}
}

// TestHandleKeyMsg_StateStats_BNotStatsOnly verifies 'b' on stats screen returns to solved.
func TestHandleKeyMsg_StateStats_BNotStatsOnly(t *testing.T) {
	m := Model{
		state:     StateStats,
		statsOnly: false,
		sizeReady: true,
	}

	model, cmd := m.handleKeyMsg(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'b'}})
	result := model.(Model)

	if result.state != StateSolved {
		t.Errorf("expected StateSolved after 'b' on stats (statsOnly=false), got %v", result.state)
	}
	if cmd != nil {
		t.Error("expected nil cmd")
	}
}

// TestHandleKeyMsg_StateStats_EscStatsOnly verifies Esc on stats screen quits in stats-only mode.
func TestHandleKeyMsg_StateStats_EscStatsOnly(t *testing.T) {
	m := Model{
		state:     StateStats,
		statsOnly: true,
		sizeReady: true,
	}

	_, cmd := m.handleKeyMsg(tea.KeyMsg{Type: tea.KeyEsc})
	if cmd == nil {
		t.Fatal("expected non-nil cmd (tea.Quit) for Esc in statsOnly mode")
	}

	// tea.Quit is a Cmd that returns a QuitMsg when invoked
	msg := cmd()
	if _, ok := msg.(tea.QuitMsg); !ok {
		t.Errorf("expected cmd to return tea.QuitMsg, got %T", msg)
	}
}

// TestRenderHelp_StatsSolved_WithClaimCode verifies '[s] Stats' appears in help when registered.
func TestRenderHelp_StatsSolved_WithClaimCode(t *testing.T) {
	m := Model{
		state:     StateSolved,
		claimCode: "TIGER-MAPLE-7492",
	}
	help := m.renderHelp()

	if !strings.Contains(help, "[s] Stats") {
		t.Errorf("renderHelp() for StateSolved with claimCode should show '[s] Stats', got: %q", help)
	}
}

// TestRenderHelp_StatsSolved_NoClaimCode verifies '[s] Stats' is absent when not registered.
func TestRenderHelp_StatsSolved_NoClaimCode(t *testing.T) {
	m := Model{
		state:     StateSolved,
		claimCode: "",
	}
	help := m.renderHelp()

	if strings.Contains(help, "[s] Stats") {
		t.Errorf("renderHelp() for StateSolved without claimCode should NOT show '[s] Stats', got: %q", help)
	}
}
