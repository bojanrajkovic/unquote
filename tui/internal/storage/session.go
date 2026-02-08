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

// sessionsDir returns the absolute path to the sessions directory (~/.local/state/unquote/sessions/).
// It uses xdg.StateFile to ensure the directory is created.
func sessionsDir() (string, error) {
	// Create a probe file to ensure directory exists, then return the directory
	probePath := filepath.Join(appName, "sessions", ".keep")
	path, err := xdg.StateFile(probePath)
	if err != nil {
		return "", fmt.Errorf("creating sessions directory: %w", err)
	}
	return filepath.Dir(path), nil
}

// sessionsRoot opens an os.Root handle on the sessions directory.
// The caller must defer root.Close().
func sessionsRoot() (*os.Root, error) {
	dir, err := sessionsDir()
	if err != nil {
		return nil, fmt.Errorf("getting sessions directory: %w", err)
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, fmt.Errorf("opening root: %w", err)
	}
	return root, nil
}

// sessionFileName returns just the filename for a session (gameID + ".json").
func sessionFileName(gameID string) string {
	return gameID + ".json"
}

// SaveSession persists a game session to disk.
// Uses os.Root to confine file operations to the sessions directory.
func SaveSession(session *GameSession) error {
	if session.GameID == "" {
		return fmt.Errorf("session has no game ID")
	}

	root, err := sessionsRoot()
	if err != nil {
		return fmt.Errorf("opening sessions root: %w", err)
	}
	defer root.Close()

	session.SavedAt = time.Now()

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling session: %w", err)
	}

	fileName := sessionFileName(session.GameID)
	tmpName := fileName + ".tmp"

	// Write to temp file then rename for atomicity
	if err := root.WriteFile(tmpName, data, 0o600); err != nil {
		return fmt.Errorf("writing session file: %w", err)
	}

	if err := root.Rename(tmpName, fileName); err != nil {
		_ = root.Remove(tmpName) // cleanup on failure
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

	root, err := sessionsRoot()
	if err != nil {
		return nil, fmt.Errorf("opening sessions root: %w", err)
	}
	defer root.Close()

	fileName := sessionFileName(gameID)
	data, err := root.ReadFile(fileName)
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

	root, err := sessionsRoot()
	if err != nil {
		return false, fmt.Errorf("opening sessions root: %w", err)
	}
	defer root.Close()

	fileName := sessionFileName(gameID)
	_, err = root.Stat(fileName)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("checking session file: %w", err)
	}

	return true, nil
}
