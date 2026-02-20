package cmd

import (
	"strings"
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/versioninfo"
)

func TestVersionCmd_OutputContainsUnquote(t *testing.T) {
	output, err := executeCommand(NewRootCmd(), "version")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if !strings.Contains(output, "unquote") {
		t.Errorf("expected version output to contain %q, got: %q", "unquote", output)
	}
}

func TestVersionCmd_OutputMatchesVersionGet(t *testing.T) {
	output, err := executeCommand(NewRootCmd(), "version")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	expected := versioninfo.Get().String()
	if !strings.Contains(output, expected) {
		t.Errorf("expected output to contain %q, got: %q", expected, output)
	}
}

func TestVersionCmd_NoError(t *testing.T) {
	_, err := executeCommand(NewRootCmd(), "version")
	if err != nil {
		t.Errorf("expected no error from version subcommand, got: %v", err)
	}
}
