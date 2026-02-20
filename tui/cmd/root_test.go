package cmd

import (
	"bytes"
	"testing"

	"github.com/spf13/cobra"
)

// executeCommand is a test helper that runs a cobra command with the given
// args, capturing output from both stdout and stderr.
func executeCommand(root *cobra.Command, args ...string) (string, error) {
	buf := new(bytes.Buffer)
	root.SetOut(buf)
	root.SetErr(buf)
	root.SetArgs(args)
	err := root.Execute()
	return buf.String(), err
}

func TestNewRootCmd_NotNil(t *testing.T) {
	cmd := NewRootCmd()
	if cmd == nil {
		t.Fatal("NewRootCmd() returned nil")
	}
}

func TestNewRootCmd_Use(t *testing.T) {
	cmd := NewRootCmd()
	if cmd.Use != "unquote" {
		t.Errorf("expected Use to be %q, got %q", "unquote", cmd.Use)
	}
}

func TestNewRootCmd_RunEIsNonNil(t *testing.T) {
	cmd := NewRootCmd()
	if cmd.RunE == nil {
		t.Error("expected RunE to be non-nil")
	}
}

func TestNewRootCmd_RandomFlagRegistered(t *testing.T) {
	cmd := NewRootCmd()
	flag := cmd.PersistentFlags().Lookup("random")
	if flag == nil {
		t.Fatal("expected --random persistent flag to be registered")
	}
	if flag.DefValue != "false" {
		t.Errorf("expected --random default to be %q, got %q", "false", flag.DefValue)
	}
}

func TestNewRootCmd_InsecureFlagRegistered(t *testing.T) {
	cmd := NewRootCmd()
	flag := cmd.PersistentFlags().Lookup("insecure")
	if flag == nil {
		t.Fatal("expected --insecure persistent flag to be registered")
	}
	if flag.DefValue != "false" {
		t.Errorf("expected --insecure default to be %q, got %q", "false", flag.DefValue)
	}
}

func TestNewRootCmd_UnknownFlagProducesError(t *testing.T) {
	_, err := executeCommand(NewRootCmd(), "--nonexistent-flag")
	if err == nil {
		t.Error("expected error for unknown flag, got nil")
	}
}

func TestNewRootCmd_VersionSubcommandRegistered(t *testing.T) {
	root := NewRootCmd()
	var found bool
	for _, sub := range root.Commands() {
		if sub.Use == "version" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'version' subcommand to be registered")
	}
}
