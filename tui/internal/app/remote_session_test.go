package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

// TestRemoteSession_AC31_ShowsSolvedElsewhere verifies that a remote completion
// shows the "Solved on another device" message with formatted completion time.
func TestRemoteSession_AC31_ShowsSolvedElsewhere(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying
	m.puzzle = &api.Puzzle{ID: "test-game-id"}
	m.claimCode = "ABCD-1234"
	m.cells = []puzzle.Cell{{Kind: puzzle.CellLetter, Char: 'A'}}

	// Call handleRemoteSession with a session response
	remoteSession := &api.SessionLookupResponse{
		CompletionTime: 53260,
		SolvedAt:       "2026-02-23T22:15:30.000Z",
	}
	model, cmd := m.handleRemoteSession(remoteSessionMsg{session: remoteSession})
	m = model.(Model)

	// Verify state transitions
	if m.state != StateSolved {
		t.Errorf("AC3.1: expected state StateSolved, got %v", m.state)
	}
	if !m.solvedElsewhere {
		t.Errorf("AC3.1: expected solvedElsewhere to be true")
	}
	expectedDuration := 53260 * time.Millisecond
	if m.elapsedAtPause != expectedDuration {
		t.Errorf("AC3.1: expected elapsedAtPause %v, got %v", expectedDuration, m.elapsedAtPause)
	}
	if m.statusMsg != "" {
		t.Errorf("AC3.1: expected empty statusMsg, got %q", m.statusMsg)
	}
	if cmd != nil {
		t.Error("AC3.1: expected no command returned")
	}

	// Verify renderStatus output contains "Solved on another device"
	status := m.renderStatus()
	if !strings.Contains(status, "Solved on another device") {
		t.Errorf("AC3.1: renderStatus output should contain 'Solved on another device', got %q", status)
	}
	if !strings.Contains(status, "0:53") {
		t.Errorf("AC3.1: renderStatus output should contain formatted time '0:53', got %q", status)
	}
}

// TestRemoteSession_AC32_StatsKeyWorks verifies that the stats key ('s') remains
// functional on the solved-elsewhere screen.
func TestRemoteSession_AC32_StatsKeyWorks(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(api.PlayerStatsResponse{})
	}))
	defer server.Close()

	client, err := api.NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StateSolved
	m.solvedElsewhere = true
	m.claimCode = "ABCD-1234"

	// Verify renderHelp contains "[s] Stats"
	help := m.renderHelp()
	if !strings.Contains(help, "[s] Stats") {
		t.Errorf("AC3.2: renderHelp should contain '[s] Stats', got %q", help)
	}
}

// TestRemoteSession_AC33_LocalSolveWinsOverRemote verifies that local solved state
// takes precedence over remote completion.
func TestRemoteSession_AC33_LocalSolveWinsOverRemote(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StateSolved
	m.solvedElsewhere = false

	// Call handleRemoteSession while already locally solved
	remoteSession := &api.SessionLookupResponse{
		CompletionTime: 53260,
		SolvedAt:       "2026-02-23T22:15:30.000Z",
	}
	model, cmd := m.handleRemoteSession(remoteSessionMsg{session: remoteSession})
	m = model.(Model)

	// Verify state remains unchanged
	if m.state != StateSolved {
		t.Errorf("AC3.3: expected state StateSolved, got %v", m.state)
	}
	if m.solvedElsewhere {
		t.Errorf("AC3.3: expected solvedElsewhere to be false (remote result ignored)")
	}
	if cmd != nil {
		t.Error("AC3.3: expected no command returned")
	}
}

// TestRemoteSession_AC34_404ReturnsNilGameplayContinues verifies that 404 responses
// are silently handled and gameplay continues normally.
func TestRemoteSession_AC34_404ReturnsNilGameplayContinues(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying

	// Call handleRemoteSession with nil session (404 or error)
	model, cmd := m.handleRemoteSession(remoteSessionMsg{session: nil})
	m = model.(Model)

	// Verify state unchanged
	if m.state != StatePlaying {
		t.Errorf("AC3.4: expected state StatePlaying, got %v", m.state)
	}
	if cmd != nil {
		t.Error("AC3.4: expected no command returned")
	}
}

// TestRemoteSession_AC35_NetworkErrorReturnsNilGameplayContinues verifies that
// network errors are silently handled and gameplay continues (same as 404).
func TestRemoteSession_AC35_NetworkErrorReturnsNilGameplayContinues(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying

	// Call handleRemoteSession with nil session (simulating network error)
	model, cmd := m.handleRemoteSession(remoteSessionMsg{session: nil})
	m = model.(Model)

	// Verify state unchanged (gameplay continues)
	if m.state != StatePlaying {
		t.Errorf("AC3.5: expected state StatePlaying, got %v", m.state)
	}
	if cmd != nil {
		t.Error("AC3.5: expected no command returned")
	}
}

// TestRemoteSession_AC36_NoClaimCodeSkipsRemoteCheck verifies that the remote check
// is skipped entirely when no claim code is configured.
func TestRemoteSession_AC36_NoClaimCodeSkipsRemoteCheck(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying
	m.claimCode = "" // No claim code set
	m.puzzle = &api.Puzzle{ID: "test-game-id"}
	m.cells = []puzzle.Cell{{Kind: puzzle.CellLetter, Char: 'A'}}

	// Call handleSessionLoaded with nil session (fresh load)
	model, cmd := m.handleSessionLoaded(sessionLoadedMsg{session: nil})
	m = model.(Model)

	// Verify state is still playing
	if m.state != StatePlaying {
		t.Errorf("AC3.6: expected state StatePlaying, got %v", m.state)
	}

	// The returned command should only be tickCmd, not include checkRemoteSessionCmd.
	if cmd == nil {
		t.Error("AC3.6: expected a command (tickCmd)")
		return
	}

	// Execute the command to get the message type
	msg := cmd()
	if _, ok := msg.(tickMsg); !ok {
		t.Errorf("AC3.6: expected tickMsg, got %T", msg)
	}
}

// TestRemoteSession_AC36_WithClaimCodeFiresRemoteCheck verifies that the remote check
// IS fired when a claim code is configured and session is nil.
// The batch returned by handleSessionLoaded should contain 2 commands (tick + remote check),
// not just 1 (tick only). HTTP behavior of checkRemoteSessionCmd is verified by TestGetSession_*.
func TestRemoteSession_AC36_WithClaimCodeFiresRemoteCheck(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying
	m.claimCode = "ABCD-1234"
	m.puzzle = &api.Puzzle{ID: "test-game-id"}
	m.cells = []puzzle.Cell{{Kind: puzzle.CellLetter, Char: 'A'}}
	m.client = client

	// Call handleSessionLoaded with nil session
	model, cmd := m.handleSessionLoaded(sessionLoadedMsg{session: nil})
	m = model.(Model)

	// Verify state is still playing
	if m.state != StatePlaying {
		t.Errorf("AC3.6: expected state StatePlaying, got %v", m.state)
	}

	// Verify that cmd is not nil (it should be a batch with tickCmd and checkRemoteSessionCmd)
	if cmd == nil {
		t.Error("AC3.6: expected a command to be returned")
		return
	}

	// Execute the batch wrapper to get the inner commands.
	// tea.Batch with 2+ commands returns a function that wraps them in a BatchMsg ([]tea.Cmd).
	// A single tickCmd would return tickMsg directly, not a BatchMsg.
	result := cmd()
	if batch, ok := result.(tea.BatchMsg); ok {
		if len(batch) != 2 {
			t.Errorf("AC3.6: expected batch with 2 commands (tick + remote check), got %d", len(batch))
		}
	} else {
		// If not a BatchMsg, it's a single command (tickCmd only) — remote check was not included
		t.Errorf("AC3.6: expected BatchMsg (tick + remote check), got %T — remote check not included", result)
	}
}

// TestRemoteSession_RaceConditionLocalSolveBeforeRemoteCheck verifies that if the
// player solves locally while the remote check is in flight, the local solve wins.
func TestRemoteSession_RaceConditionLocalSolveBeforeRemoteCheck(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	// Start in playing state (just loaded session, remote check is in flight)
	m.state = StatePlaying
	m.solvedElsewhere = false

	// Meanwhile, handleSolutionChecked transitions to StateSolved
	m.state = StateSolved
	m.elapsedAtPause = 60 * time.Second

	// Then the remote check completes
	remoteSession := &api.SessionLookupResponse{
		CompletionTime: 53260,
		SolvedAt:       "2026-02-23T22:15:30.000Z",
	}
	model, cmd := m.handleRemoteSession(remoteSessionMsg{session: remoteSession})
	m = model.(Model)

	// Verify that local solve state is preserved
	if m.state != StateSolved {
		t.Errorf("AC3.3 (race): expected state StateSolved, got %v", m.state)
	}
	if m.solvedElsewhere {
		t.Errorf("AC3.3 (race): expected solvedElsewhere to be false (local state preserved)")
	}
	if m.elapsedAtPause != 60*time.Second {
		t.Errorf("AC3.3 (race): expected elapsed time to be preserved as 60s, got %v", m.elapsedAtPause)
	}
	if cmd != nil {
		t.Error("AC3.3 (race): expected no command returned")
	}
}

// TestRemoteSession_FormattedElapsedTime verifies that the elapsed time is
// correctly converted from milliseconds and formatted.
func TestRemoteSession_FormattedElapsedTime(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	tests := []struct {
		name           string
		expectedOutput string
		completionTime float64
	}{
		{
			name:           "53 seconds",
			completionTime: 53260,
			expectedOutput: "0:53",
		},
		{
			name:           "2 minutes 8 seconds",
			completionTime: 128000,
			expectedOutput: "2:08",
		},
		{
			name:           "1 minute",
			completionTime: 60000,
			expectedOutput: "1:00",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewWithClient(client)
			m.state = StatePlaying

			remoteSession := &api.SessionLookupResponse{
				CompletionTime: tt.completionTime,
				SolvedAt:       "2026-02-23T22:15:30.000Z",
			}
			model, _ := m.handleRemoteSession(remoteSessionMsg{session: remoteSession})
			m = model.(Model)

			status := m.renderStatus()
			if !strings.Contains(status, tt.expectedOutput) {
				t.Errorf("expected status to contain %q, got %q", tt.expectedOutput, status)
			}
		})
	}
}

// TestRemoteSession_ElapsedConversion verifies that the CompletionTime (float64 milliseconds)
// is correctly converted to time.Duration.
func TestRemoteSession_ElapsedConversion(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying

	// Test that CompletionTime from API is correctly converted to time.Duration
	remoteSession := &api.SessionLookupResponse{
		CompletionTime: 53260,
		SolvedAt:       "2026-02-23T22:15:30.000Z",
	}
	model, _ := m.handleRemoteSession(remoteSessionMsg{session: remoteSession})
	m = model.(Model)

	// 53260 milliseconds -> time.Duration(53260) * time.Millisecond
	expectedDuration := time.Duration(53260) * time.Millisecond
	if m.elapsedAtPause != expectedDuration {
		t.Errorf("expected elapsedAtPause %v, got %v", expectedDuration, m.elapsedAtPause)
	}
}

// TestRemoteSession_HeaderNotModified verifies that other model fields remain
// unmodified when handling a remote session.
func TestRemoteSession_HeaderNotModified(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying
	m.puzzle = &api.Puzzle{ID: "test-game-id", Date: "2026-02-23"}
	m.claimCode = "ABCD-1234"
	m.errorMsg = ""
	m.width = 80
	m.height = 24

	remoteSession := &api.SessionLookupResponse{
		CompletionTime: 53260,
		SolvedAt:       "2026-02-23T22:15:30.000Z",
	}
	model, _ := m.handleRemoteSession(remoteSessionMsg{session: remoteSession})
	m = model.(Model)

	// Verify other fields are unchanged
	if m.puzzle.ID != "test-game-id" {
		t.Errorf("expected puzzle ID to remain 'test-game-id'")
	}
	if m.puzzle.Date != "2026-02-23" {
		t.Errorf("expected puzzle Date to remain '2026-02-23'")
	}
	if m.claimCode != "ABCD-1234" {
		t.Errorf("expected claimCode to remain 'ABCD-1234'")
	}
	if m.width != 80 {
		t.Errorf("expected width to remain 80")
	}
	if m.height != 24 {
		t.Errorf("expected height to remain 24")
	}
}

// TestRemoteSession_MessageIntegration verifies that remoteSessionMsg can be properly
// constructed and used in the Update loop.
func TestRemoteSession_MessageIntegration(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying
	m.puzzle = &api.Puzzle{ID: "test-game-id"}

	// Create a remoteSessionMsg with a session
	msg := remoteSessionMsg{
		session: &api.SessionLookupResponse{
			CompletionTime: 45000,
			SolvedAt:       "2026-02-23T10:00:00.000Z",
		},
	}

	// Pass through Update
	updatedModel, cmd := m.Update(msg)
	updatedM := updatedModel.(Model)

	// Verify state changed
	if updatedM.state != StateSolved {
		t.Errorf("expected state to be StateSolved, got %v", updatedM.state)
	}
	if !updatedM.solvedElsewhere {
		t.Errorf("expected solvedElsewhere to be true")
	}
	if cmd != nil {
		t.Error("expected no command returned")
	}
}

// TestRemoteSession_WithNilSessionMessage verifies that remoteSessionMsg with nil session
// properly continues gameplay.
func TestRemoteSession_WithNilSessionMessage(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying
	m.puzzle = &api.Puzzle{ID: "test-game-id"}

	// Create a remoteSessionMsg with nil session
	msg := remoteSessionMsg{session: nil}

	// Pass through Update
	updatedModel, cmd := m.Update(msg)
	updatedM := updatedModel.(Model)

	// Verify state unchanged (gameplay continues)
	if updatedM.state != StatePlaying {
		t.Errorf("expected state to be StatePlaying, got %v", updatedM.state)
	}
	if updatedM.solvedElsewhere {
		t.Errorf("expected solvedElsewhere to be false")
	}
	if cmd != nil {
		t.Error("expected no command returned")
	}
}

// TestRemoteSession_MultipleRemoteChecks verifies that multiple remote checks
// are handled correctly (only the first non-nil one should transition to solved).
func TestRemoteSession_MultipleRemoteChecks(t *testing.T) {
	client, err := api.NewClient(true)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	m := NewWithClient(client)
	m.state = StatePlaying

	// First remote check returns nil (404)
	model, _ := m.handleRemoteSession(remoteSessionMsg{session: nil})
	m = model.(Model)
	if m.state != StatePlaying {
		t.Errorf("after first check: expected state StatePlaying, got %v", m.state)
	}

	// Second remote check succeeds
	remoteSession := &api.SessionLookupResponse{
		CompletionTime: 53260,
		SolvedAt:       "2026-02-23T22:15:30.000Z",
	}
	model, _ = m.handleRemoteSession(remoteSessionMsg{session: remoteSession})
	m = model.(Model)
	if m.state != StateSolved {
		t.Errorf("after second check: expected state StateSolved, got %v", m.state)
	}
	if !m.solvedElsewhere {
		t.Errorf("after second check: expected solvedElsewhere to be true")
	}
}
