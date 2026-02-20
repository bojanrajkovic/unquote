package cmd

import (
	"strings"
	"testing"

	"github.com/adrg/xdg"
)

func TestLinkCmd_Success(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	xdg.Reload()

	output, err := executeCommand(NewRootCmd(), "link", "TEST-CODE-1234")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !strings.Contains(output, "TEST-CODE-1234") {
		t.Errorf("expected output to contain claim code, got: %q", output)
	}
	if !strings.Contains(output, "Linked") {
		t.Errorf("expected output to confirm linking, got: %q", output)
	}
}

func TestLinkCmd_MissingArgument(t *testing.T) {
	_, err := executeCommand(NewRootCmd(), "link")
	if err == nil {
		t.Error("expected error for missing argument, got nil")
	}
}
