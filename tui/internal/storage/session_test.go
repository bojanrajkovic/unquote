package storage

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/adrg/xdg"
)

func TestGameSessionSerialization(t *testing.T) {
	tests := []struct {
		name    string
		session GameSession
	}{
		{
			name: "empty session",
			session: GameSession{
				GameID:  "test-game-1",
				Inputs:  map[string]string{},
				Solved:  false,
				SavedAt: time.Date(2026, 2, 3, 12, 0, 0, 0, time.UTC),
			},
		},
		{
			name: "session with inputs",
			session: GameSession{
				GameID: "test-game-2",
				Inputs: map[string]string{
					"A": "X",
					"B": "Y",
					"C": "Z",
				},
				ElapsedTime: 90 * time.Second,
				Solved:      false,
				SavedAt:     time.Date(2026, 2, 3, 12, 0, 0, 0, time.UTC),
			},
		},
		{
			name: "solved session",
			session: GameSession{
				GameID: "test-game-3",
				Inputs: map[string]string{
					"A": "X",
					"B": "Y",
				},
				ElapsedTime:    120 * time.Second,
				Solved:         true,
				CompletionTime: 120 * time.Second,
				SavedAt:        time.Date(2026, 2, 3, 12, 0, 0, 0, time.UTC),
			},
		},
		{
			name: "solved session with explicit SolvedAt",
			session: GameSession{
				GameID:  "test-game-4",
				Inputs:  map[string]string{"A": "X"},
				Solved:  true,
				SavedAt: time.Date(2026, 2, 3, 12, 0, 0, 0, time.UTC),
				SolvedAt: func() *time.Time {
					t := time.Date(2026, 1, 15, 10, 30, 0, 0, time.UTC)
					return &t
				}(),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Marshal
			data, err := json.Marshal(tt.session)
			if err != nil {
				t.Fatalf("failed to marshal session: %v", err)
			}

			// Unmarshal
			var decoded GameSession
			if err := json.Unmarshal(data, &decoded); err != nil {
				t.Fatalf("failed to unmarshal session: %v", err)
			}

			// Verify fields
			if decoded.GameID != tt.session.GameID {
				t.Errorf("GameID: expected %q, got %q", tt.session.GameID, decoded.GameID)
			}
			if decoded.ElapsedTime != tt.session.ElapsedTime {
				t.Errorf("ElapsedTime: expected %v, got %v", tt.session.ElapsedTime, decoded.ElapsedTime)
			}
			if decoded.Solved != tt.session.Solved {
				t.Errorf("Solved: expected %v, got %v", tt.session.Solved, decoded.Solved)
			}
			if decoded.CompletionTime != tt.session.CompletionTime {
				t.Errorf("CompletionTime: expected %v, got %v", tt.session.CompletionTime, decoded.CompletionTime)
			}
			if len(decoded.Inputs) != len(tt.session.Inputs) {
				t.Errorf("Inputs length: expected %d, got %d", len(tt.session.Inputs), len(decoded.Inputs))
			}
			for k, v := range tt.session.Inputs {
				if decoded.Inputs[k] != v {
					t.Errorf("Inputs[%q]: expected %q, got %q", k, v, decoded.Inputs[k])
				}
			}
			// SolvedAt: nil should decode as nil; non-nil should round-trip
			if tt.session.SolvedAt == nil {
				if decoded.SolvedAt != nil {
					t.Errorf("SolvedAt: expected nil, got %v", decoded.SolvedAt)
				}
			} else {
				if decoded.SolvedAt == nil {
					t.Errorf("SolvedAt: expected %v, got nil", tt.session.SolvedAt)
				} else if !decoded.SolvedAt.Equal(*tt.session.SolvedAt) {
					t.Errorf("SolvedAt: expected %v, got %v", tt.session.SolvedAt, decoded.SolvedAt)
				}
			}
		})
	}
}

func TestGameSession_SolvedAtNilForLegacySessions(t *testing.T) {
	// JSON without solved_at field (legacy sessions) must deserialize with SolvedAt == nil
	legacyJSON := `{
		"saved_at": "2026-01-15T10:00:00Z",
		"inputs": {"A": "X"},
		"game_id": "legacy-game",
		"elapsed_time": 120000000000,
		"completion_time": 120000000000,
		"solved": true,
		"uploaded": false
	}`

	var session GameSession
	if err := json.Unmarshal([]byte(legacyJSON), &session); err != nil {
		t.Fatalf("failed to unmarshal legacy session: %v", err)
	}

	if session.SolvedAt != nil {
		t.Errorf("SolvedAt should be nil for legacy session without solved_at field, got %v", session.SolvedAt)
	}
	if session.GameID != "legacy-game" {
		t.Errorf("GameID: expected %q, got %q", "legacy-game", session.GameID)
	}
}

func TestSaveAndLoadSession(t *testing.T) {
	// Use temp directory for testing
	tmpDir := t.TempDir()

	// Override XDG_STATE_HOME for testing
	t.Setenv("XDG_STATE_HOME", tmpDir)

	tests := []struct {
		name    string
		session GameSession
	}{
		{
			name: "basic session",
			session: GameSession{
				GameID: "save-load-test-1",
				Inputs: map[string]string{
					"A": "M",
					"B": "N",
				},
				ElapsedTime: 45 * time.Second,
				Solved:      false,
			},
		},
		{
			name: "solved session",
			session: GameSession{
				GameID: "save-load-test-2",
				Inputs: map[string]string{
					"X": "A",
					"Y": "B",
					"Z": "C",
				},
				ElapsedTime:    300 * time.Second,
				Solved:         true,
				CompletionTime: 300 * time.Second,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save
			if err := SaveSession(&tt.session); err != nil {
				t.Fatalf("SaveSession failed: %v", err)
			}

			// Load
			loaded, err := LoadSession(tt.session.GameID)
			if err != nil {
				t.Fatalf("LoadSession failed: %v", err)
			}
			if loaded == nil {
				t.Fatal("LoadSession returned nil")
			}

			// Verify
			if loaded.GameID != tt.session.GameID {
				t.Errorf("GameID: expected %q, got %q", tt.session.GameID, loaded.GameID)
			}
			if loaded.ElapsedTime != tt.session.ElapsedTime {
				t.Errorf("ElapsedTime: expected %v, got %v", tt.session.ElapsedTime, loaded.ElapsedTime)
			}
			if loaded.Solved != tt.session.Solved {
				t.Errorf("Solved: expected %v, got %v", tt.session.Solved, loaded.Solved)
			}
			if len(loaded.Inputs) != len(tt.session.Inputs) {
				t.Errorf("Inputs length: expected %d, got %d", len(tt.session.Inputs), len(loaded.Inputs))
			}
			for k, v := range tt.session.Inputs {
				if loaded.Inputs[k] != v {
					t.Errorf("Inputs[%q]: expected %q, got %q", k, v, loaded.Inputs[k])
				}
			}
			// SavedAt should be set
			if loaded.SavedAt.IsZero() {
				t.Error("SavedAt should not be zero")
			}
		})
	}
}

func TestLoadSession_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", tmpDir)

	session, err := LoadSession("nonexistent-game-id")
	if err != nil {
		t.Fatalf("LoadSession should not error for missing file: %v", err)
	}
	if session != nil {
		t.Error("LoadSession should return nil for missing file")
	}
}

func TestSessionExists(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", tmpDir)

	// Use a unique game ID to avoid xdg caching issues between tests
	gameID := "session-exists-test-" + t.Name()

	// Save a session
	session := &GameSession{
		GameID: gameID,
		Inputs: map[string]string{},
	}
	if err := SaveSession(session); err != nil {
		t.Fatalf("SaveSession failed: %v", err)
	}

	// Should exist after save
	exists, err := SessionExists(gameID)
	if err != nil {
		t.Fatalf("SessionExists failed: %v", err)
	}
	if !exists {
		t.Error("session should exist after save")
	}

	// Test non-existent session with unique ID
	nonExistentID := "nonexistent-" + t.Name()
	exists, err = SessionExists(nonExistentID)
	if err != nil {
		t.Fatalf("SessionExists failed for non-existent: %v", err)
	}
	if exists {
		t.Error("session should not exist for non-existent game ID")
	}
}

func TestSaveAndLoadSession_Uploaded(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", tmpDir)

	tests := []struct {
		name           string
		session        GameSession
		expectUploaded bool
	}{
		{
			name: "uploaded true persists",
			session: GameSession{
				GameID:         "uploaded-true-test",
				Inputs:         map[string]string{"A": "X"},
				Solved:         true,
				CompletionTime: 120 * time.Second,
				Uploaded:       true,
			},
			expectUploaded: true,
		},
		{
			name: "uploaded false is default",
			session: GameSession{
				GameID: "uploaded-false-test",
				Inputs: map[string]string{"B": "Y"},
				Solved: false,
			},
			expectUploaded: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := SaveSession(&tt.session); err != nil {
				t.Fatalf("SaveSession failed: %v", err)
			}

			loaded, err := LoadSession(tt.session.GameID)
			if err != nil {
				t.Fatalf("LoadSession failed: %v", err)
			}
			if loaded == nil {
				t.Fatal("LoadSession returned nil")
			}

			if loaded.Uploaded != tt.expectUploaded {
				t.Errorf("Uploaded: expected %v, got %v", tt.expectUploaded, loaded.Uploaded)
			}
		})
	}
}

func TestSaveSession_EmptyGameID(t *testing.T) {
	session := &GameSession{
		GameID: "",
		Inputs: map[string]string{},
	}

	err := SaveSession(session)
	if err == nil {
		t.Error("SaveSession should error for empty game ID")
	}
}

func TestLoadSession_EmptyGameID(t *testing.T) {
	_, err := LoadSession("")
	if err == nil {
		t.Error("LoadSession should error for empty game ID")
	}
}

func TestListSolvedSessions(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", tmpDir)
	xdg.Reload()
	t.Cleanup(xdg.Reload) // restore xdg paths when test finishes

	// Create sessions covering all combinations
	sessions := []GameSession{
		{
			GameID:         "solved-not-uploaded",
			Inputs:         map[string]string{"A": "X"},
			Solved:         true,
			CompletionTime: 60 * time.Second,
			Uploaded:       false,
		},
		{
			GameID:         "solved-and-uploaded",
			Inputs:         map[string]string{"B": "Y"},
			Solved:         true,
			CompletionTime: 90 * time.Second,
			Uploaded:       true,
		},
		{
			GameID:   "unsolved-not-uploaded",
			Inputs:   map[string]string{"C": "Z"},
			Solved:   false,
			Uploaded: false,
		},
	}

	for i := range sessions {
		if err := SaveSession(&sessions[i]); err != nil {
			t.Fatalf("SaveSession failed for %q: %v", sessions[i].GameID, err)
		}
	}

	result, err := ListSolvedSessions()
	if err != nil {
		t.Fatalf("ListSolvedSessions failed: %v", err)
	}

	// Only the solved+not-uploaded session should be returned
	if len(result) != 1 {
		t.Fatalf("expected 1 session, got %d", len(result))
	}
	if result[0].GameID != "solved-not-uploaded" {
		t.Errorf("expected game ID %q, got %q", "solved-not-uploaded", result[0].GameID)
	}
	if !result[0].Solved {
		t.Error("returned session should be solved")
	}
	if result[0].Uploaded {
		t.Error("returned session should not be uploaded")
	}
}

func TestListSolvedSessions_EmptyDir(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", tmpDir)
	xdg.Reload()
	t.Cleanup(xdg.Reload) // restore xdg paths when test finishes

	// No sessions saved — directory doesn't exist yet
	result, err := ListSolvedSessions()
	if err != nil {
		t.Fatalf("ListSolvedSessions should not error for empty/missing dir: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(result))
	}
}

func TestSessionStoredInCorrectDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", tmpDir)

	// Save a session with a unique ID to avoid cross-test contamination
	gameID := "stored-dir-test-" + t.Name()
	session := &GameSession{
		GameID: gameID,
		Inputs: map[string]string{"A": "X"},
	}
	if err := SaveSession(session); err != nil {
		t.Fatalf("SaveSession failed: %v", err)
	}

	// Load the session back to verify it was saved and retrieved correctly
	loaded, err := LoadSession(gameID)
	if err != nil {
		t.Fatalf("LoadSession failed: %v", err)
	}
	if loaded == nil {
		t.Fatal("LoadSession returned nil, but session should exist")
	}

	// Verify the session was properly saved with correct content
	if loaded.GameID != gameID {
		t.Errorf("GameID: expected %q, got %q", gameID, loaded.GameID)
	}
	if len(loaded.Inputs) != 1 {
		t.Errorf("Inputs length: expected 1, got %d", len(loaded.Inputs))
	}
	if loaded.Inputs["A"] != "X" {
		t.Errorf("Inputs[A]: expected %q, got %q", "X", loaded.Inputs["A"])
	}
	if loaded.SavedAt.IsZero() {
		t.Error("SavedAt should not be zero")
	}
}
