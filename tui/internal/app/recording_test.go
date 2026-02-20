package app

import (
	"strings"
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/config"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

// newTestClient returns an API client pointed at a local stub URL.
// Tests that don't invoke HTTP can use a nil client directly on the model.
func newTestClient(t *testing.T) *api.Client {
	t.Helper()
	client, err := api.NewClientWithURL("http://localhost:19999", true)
	if err != nil {
		t.Fatalf("newTestClient: %v", err)
	}
	return client
}

// TestAC3_1_SolveWithClaimCode_BatchesRecordCmd verifies AC3.1:
// A registered player solving a puzzle triggers both saveSolvedSessionCmd
// and recordSessionCmd (returned as a non-nil batch cmd).
func TestAC3_1_SolveWithClaimCode_BatchesRecordCmd(t *testing.T) {
	client := newTestClient(t)
	m := Model{
		state:     StateChecking,
		claimCode: "TIGER-MAPLE-7492",
		client:    client,
		puzzle:    &api.Puzzle{ID: "game-001"},
		cells:     []puzzle.Cell{{Kind: puzzle.CellLetter, Char: 'A', Input: 'B'}},
	}

	resultModel, cmd := m.handleSolutionChecked(solutionCheckedMsg{correct: true})
	result := resultModel.(Model)

	if result.state != StateSolved {
		t.Errorf("state: want StateSolved (%d), got %d", StateSolved, result.state)
	}
	if cmd == nil {
		t.Error("cmd: want non-nil batch (save + record), got nil")
	}
}

// TestAC3_2_SessionRecordedMsg_FiresMarkUploadedCmd verifies AC3.2:
// Receiving sessionRecordedMsg returns markSessionUploadedCmd (non-nil).
func TestAC3_2_SessionRecordedMsg_FiresMarkUploadedCmd(t *testing.T) {
	m := Model{
		state: StateSolved,
	}

	resultModel, cmd := m.Update(sessionRecordedMsg{gameID: "game-001"})
	result := resultModel.(Model)

	if result.state != StateSolved {
		t.Errorf("state: want StateSolved (%d), got %d", StateSolved, result.state)
	}
	if cmd == nil {
		t.Error("cmd: want non-nil markSessionUploadedCmd, got nil")
	}
}

// TestAC3_3_SolvedScreen_UnregisteredPlayer_ShowsHint verifies AC3.3:
// renderHelp on StateSolved with no claimCode shows the registration hint.
func TestAC3_3_SolvedScreen_UnregisteredPlayer_ShowsHint(t *testing.T) {
	m := Model{
		state:     StateSolved,
		claimCode: "",
	}

	help := m.renderHelp()

	if !strings.Contains(help, "unquote register") {
		t.Errorf("renderHelp(): want hint containing %q, got %q", "unquote register", help)
	}
}

// TestAC3_3_SolvedScreen_RegisteredPlayer_NoHint verifies AC3.3:
// renderHelp on StateSolved with claimCode does NOT show the registration hint.
func TestAC3_3_SolvedScreen_RegisteredPlayer_NoHint(t *testing.T) {
	m := Model{
		state:     StateSolved,
		claimCode: "TIGER-MAPLE-7492",
	}

	help := m.renderHelp()

	if strings.Contains(help, "unquote register") {
		t.Errorf("renderHelp(): registered player should not see hint, got %q", help)
	}
}

// TestAC3_4_SolveWithoutClaimCode_NoRecordCmd verifies AC3.4:
// An unregistered player solving a puzzle only fires saveSolvedSessionCmd
// (not recordSessionCmd) — still returns a non-nil cmd.
func TestAC3_4_SolveWithoutClaimCode_NoRecordCmd(t *testing.T) {
	client := newTestClient(t)
	m := Model{
		state:     StateChecking,
		claimCode: "",
		client:    client,
		puzzle:    &api.Puzzle{ID: "game-002"},
		cells:     []puzzle.Cell{{Kind: puzzle.CellLetter, Char: 'A', Input: 'B'}},
	}

	resultModel, cmd := m.handleSolutionChecked(solutionCheckedMsg{correct: true})
	result := resultModel.(Model)

	if result.state != StateSolved {
		t.Errorf("state: want StateSolved (%d), got %d", StateSolved, result.state)
	}
	// cmd is saveSolvedSessionCmd only — still non-nil
	if cmd == nil {
		t.Error("cmd: want non-nil saveSolvedSessionCmd, got nil")
	}
}

// TestAC5_1_PlayerRegisteredMsg_FiresReconciliationCmd verifies AC5.1:
// Receiving playerRegisteredMsg fires reconcileSessionsCmd (returned batch is non-nil).
func TestAC5_1_PlayerRegisteredMsg_FiresReconciliationCmd(t *testing.T) {
	client := newTestClient(t)
	m := Model{
		state:  StateOnboarding,
		client: client,
	}

	resultModel, cmd := m.Update(playerRegisteredMsg{claimCode: "TIGER-MAPLE-7492"})
	result := resultModel.(Model)

	if result.state != StateClaimCodeDisplay {
		t.Errorf("state: want StateClaimCodeDisplay (%d), got %d", StateClaimCodeDisplay, result.state)
	}
	if result.claimCode != "TIGER-MAPLE-7492" {
		t.Errorf("claimCode: want %q, got %q", "TIGER-MAPLE-7492", result.claimCode)
	}
	// The batch includes saveConfigCmd + reconcileSessionsCmd
	if cmd == nil {
		t.Error("cmd: want non-nil batch (saveConfig + reconcile), got nil")
	}
}

// TestAC5_2_ConfigLoadedWithClaimCode_FiresReconciliationCmd verifies AC5.2:
// On startup with a registered player's config, reconcileSessionsCmd is fired.
func TestAC5_2_ConfigLoadedWithClaimCode_FiresReconciliationCmd(t *testing.T) {
	client := newTestClient(t)
	m := Model{
		state:  StateLoading,
		client: client,
	}

	cfg := &config.Config{StatsEnabled: true, ClaimCode: "TIGER-MAPLE-7492"}
	resultModel, cmd := m.handleConfigLoaded(configLoadedMsg{config: cfg})
	result := resultModel.(Model)

	if result.state != StateLoading {
		t.Errorf("state: want StateLoading (%d), got %d", StateLoading, result.state)
	}
	if result.claimCode != "TIGER-MAPLE-7492" {
		t.Errorf("claimCode: want %q, got %q", "TIGER-MAPLE-7492", result.claimCode)
	}
	// The batch includes fetchPuzzleCmd + reconcileSessionsCmd
	if cmd == nil {
		t.Error("cmd: want non-nil batch (fetchPuzzle + reconcile), got nil")
	}
}

// TestAC5_5_ReconciliationDoneMsg_IsNoOp verifies AC5.5:
// reconciliationDoneMsg returns the model unchanged with no further commands.
func TestAC5_5_ReconciliationDoneMsg_IsNoOp(t *testing.T) {
	m := Model{
		state: StatePlaying,
	}

	resultModel, cmd := m.Update(reconciliationDoneMsg{})
	result := resultModel.(Model)

	if result.state != StatePlaying {
		t.Errorf("state: want StatePlaying (%d), got %d", StatePlaying, result.state)
	}
	if cmd != nil {
		t.Error("cmd: want nil (no action on reconciliationDoneMsg), got non-nil")
	}
}
