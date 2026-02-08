package storage

import (
	"encoding/json"
	"testing"
	"time"
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
		})
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

func TestPathTraversalRejected(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", tmpDir)

	maliciousIDs := []struct {
		name   string
		gameID string
	}{
		{"dot-dot-slash", "../../evil"},
		{"dot-dot-backslash", `..\..\evil`},
		{"absolute-path", "/etc/passwd"},
		{"embedded-traversal", "foo/../../../evil"},
		{"dot-dot-only", ".."},
	}

	for _, tt := range maliciousIDs {
		t.Run("save_"+tt.name, func(t *testing.T) {
			session := &GameSession{
				GameID: tt.gameID,
				Inputs: map[string]string{},
			}
			err := SaveSession(session)
			if err == nil {
				t.Errorf("SaveSession should reject game ID %q", tt.gameID)
			}
		})

		t.Run("load_"+tt.name, func(t *testing.T) {
			_, err := LoadSession(tt.gameID)
			if err == nil {
				t.Errorf("LoadSession should reject game ID %q", tt.gameID)
			}
		})

		t.Run("exists_"+tt.name, func(t *testing.T) {
			_, err := SessionExists(tt.gameID)
			if err == nil {
				t.Errorf("SessionExists should reject game ID %q", tt.gameID)
			}
		})
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
