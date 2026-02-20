package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/adrg/xdg"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

// TestStatsCmd_Registered verifies the stats subcommand is registered on the root command.
func TestStatsCmd_Registered(t *testing.T) {
	root := NewRootCmd()
	var found bool
	for _, sub := range root.Commands() {
		if sub.Use == "stats" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'stats' subcommand to be registered on root")
	}
}

// TestStatsCmd_NoConfig verifies the stats command errors when no config (no claim code) exists.
func TestStatsCmd_NoConfig(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	output, err := executeCommand(NewRootCmd(), "stats")
	if err == nil {
		t.Error("expected error when no config/claim code exists")
	}

	if !strings.Contains(output, "No claim code found") {
		t.Errorf("expected 'No claim code found' in output, got: %q", output)
	}
}

// TestStatsCmd_NoClaimCode verifies the stats command errors when config exists but has no claim code.
func TestStatsCmd_NoClaimCode(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	if err := config.Save(&config.Config{StatsEnabled: false}); err != nil {
		t.Fatalf("setup: failed to save config: %v", err)
	}

	output, err := executeCommand(NewRootCmd(), "stats")
	if err == nil {
		t.Error("expected error when config has no claim code")
	}

	if !strings.Contains(output, "No claim code found") {
		t.Errorf("expected 'No claim code found' in output, got: %q", output)
	}
}

// TestStatsCmd_PrintsStats verifies the stats command fetches and prints stats to stdout.
func TestStatsCmd_PrintsStats(t *testing.T) {
	bestTime := 128000.0
	avgTime := 195000.0
	statsResp := api.PlayerStatsResponse{
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
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/player/TIGER-MAPLE-7492/stats" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(statsResp)
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	t.Setenv("UNQUOTE_API_URL", srv.URL)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	if err := config.Save(&config.Config{StatsEnabled: true, ClaimCode: "TIGER-MAPLE-7492"}); err != nil {
		t.Fatalf("setup: failed to save config: %v", err)
	}

	output, err := executeCommand(NewRootCmd(), "stats", "--insecure")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, want := range []string{"Games Played", "42", "Win Rate", "95.7%", "Best Time", "2:08", "Avg Time", "3:15", "Solve Times"} {
		if !strings.Contains(output, want) {
			t.Errorf("output missing %q", want)
		}
	}
}

// TestRenderStatsOutput verifies the output rendering function.
func TestRenderStatsOutput(t *testing.T) {
	bestTime := 128000.0
	stats := &api.PlayerStatsResponse{
		GamesPlayed:   10,
		GamesSolved:   8,
		WinRate:       0.8,
		CurrentStreak: 3,
		BestStreak:    5,
		BestTime:      &bestTime,
	}

	output := renderStatsOutput(stats)

	for _, want := range []string{"CRYPTO-QUIP STATS", "Games Played", "10", "Win Rate", "80.0%", "Best Time", "2:08"} {
		if !strings.Contains(output, want) {
			t.Errorf("renderStatsOutput missing %q", want)
		}
	}
}

// TestRenderStatsOutput_NilTimes verifies nil times render as "—".
func TestRenderStatsOutput_NilTimes(t *testing.T) {
	stats := &api.PlayerStatsResponse{GamesPlayed: 1}
	output := renderStatsOutput(stats)

	if !strings.Contains(output, "—") {
		t.Errorf("expected '—' for nil times, got: %q", output)
	}
}
