package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/adrg/xdg"
)

// appName is the subdirectory name within the XDG state directory
const appName = "unquote"

// GameSession represents the persisted state of a puzzle game
type GameSession struct {
	SavedAt        time.Time         `json:"saved_at"`
	Inputs         map[string]string `json:"inputs"`
	GameID         string            `json:"game_id"`
	ElapsedTime    time.Duration     `json:"elapsed_time"`
	CompletionTime time.Duration     `json:"completion_time"`
	Solved         bool              `json:"solved"`
}

// sessionPath returns the full path for a game session file.
// Uses xdg.StateFile which creates directories as needed.
func sessionPath(gameID string) (string, error) {
	relPath := filepath.Join(appName, "sessions", gameID+".json")
	return xdg.StateFile(relPath)
}

// SaveSession persists a game session to disk.
// Creates the session directory if it doesn't exist.
func SaveSession(session *GameSession) error {
	if session.GameID == "" {
		return fmt.Errorf("session has no game ID")
	}

	path, err := sessionPath(session.GameID)
	if err != nil {
		return fmt.Errorf("getting session path: %w", err)
	}

	session.SavedAt = time.Now()

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling session: %w", err)
	}

	// Write to temp file then rename for atomicity
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0o600); err != nil {
		return fmt.Errorf("writing session file: %w", err)
	}

	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath) // cleanup on failure
		return fmt.Errorf("renaming session file: %w", err)
	}

	return nil
}

// LoadSession loads a game session from disk.
// Returns nil, nil if the session file doesn't exist.
func LoadSession(gameID string) (*GameSession, error) {
	if gameID == "" {
		return nil, fmt.Errorf("game ID is empty")
	}

	path, err := sessionPath(gameID)
	if err != nil {
		return nil, fmt.Errorf("getting session path: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // no session exists
		}
		return nil, fmt.Errorf("reading session file: %w", err)
	}

	var session GameSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, fmt.Errorf("unmarshaling session: %w", err)
	}

	return &session, nil
}

// SessionExists checks if a session file exists for the given game ID.
func SessionExists(gameID string) (bool, error) {
	if gameID == "" {
		return false, fmt.Errorf("game ID is empty")
	}

	path, err := sessionPath(gameID)
	if err != nil {
		return false, fmt.Errorf("getting session path: %w", err)
	}

	_, err = os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("checking session file: %w", err)
	}

	return true, nil
}
