package cmd

import (
	"strings"
	"testing"

	"github.com/adrg/xdg"

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

	// Save config with no claim code (opted out)
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
