package cmd

import (
	"strings"
	"testing"

	"github.com/adrg/xdg"

	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

func TestClaimCodeCmd_WithConfig(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	if err := config.Save(&config.Config{ClaimCode: "TIGER-MAPLE-7492", StatsEnabled: true}); err != nil {
		t.Fatalf("setup: failed to save config: %v", err)
	}

	output, err := executeCommand(NewRootCmd(), "claim-code")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !strings.Contains(output, "TIGER-MAPLE-7492") {
		t.Errorf("expected output to contain claim code, got: %q", output)
	}
}

func TestClaimCodeCmd_NoConfig(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	output, err := executeCommand(NewRootCmd(), "claim-code")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !strings.Contains(output, "No claim code found") {
		t.Errorf("expected helpful message, got: %q", output)
	}
	if !strings.Contains(output, "unquote register") {
		t.Errorf("expected output to suggest 'unquote register', got: %q", output)
	}
}
