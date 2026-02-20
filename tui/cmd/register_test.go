package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/adrg/xdg"

	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

func TestRegisterCmd_Success(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/player" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]string{"claimCode": "TIGER-MAPLE-7492"})
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	t.Setenv("UNQUOTE_API_URL", server.URL)

	output, err := executeCommand(NewRootCmd(), "register")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !strings.Contains(output, "TIGER-MAPLE-7492") {
		t.Errorf("expected output to contain claim code, got: %q", output)
	}
}

func TestRegisterCmd_AlreadyRegistered(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	// Save a pre-existing config
	if err := config.Save(&config.Config{ClaimCode: "ALREADY-SET-1234", StatsEnabled: true}); err != nil {
		t.Fatalf("setup: failed to save config: %v", err)
	}

	output, err := executeCommand(NewRootCmd(), "register")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !strings.Contains(output, "ALREADY-SET-1234") {
		t.Errorf("expected output to contain existing claim code, got: %q", output)
	}
	if !strings.Contains(output, "Already registered") {
		t.Errorf("expected output to mention already registered, got: %q", output)
	}
}
