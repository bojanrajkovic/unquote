package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/adrg/xdg"
)

// Config holds persistent player preferences and identity.
type Config struct {
	ClaimCode    string `json:"claim_code"`
	StatsEnabled bool   `json:"stats_enabled"`
}

// configDir returns the absolute path to the config directory (~/.config/unquote/).
// It uses xdg.ConfigFile to ensure the directory is created.
func configDir() (string, error) {
	// Create a probe file to ensure directory exists, then return the directory
	path, err := xdg.ConfigFile(filepath.Join("unquote", ".keep"))
	if err != nil {
		return "", fmt.Errorf("creating config directory: %w", err)
	}
	return filepath.Dir(path), nil
}

// configRoot opens an os.Root handle on the config directory.
// The caller must defer root.Close().
func configRoot() (*os.Root, error) {
	dir, err := configDir()
	if err != nil {
		return nil, fmt.Errorf("getting config directory: %w", err)
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, fmt.Errorf("opening root: %w", err)
	}
	return root, nil
}

// Load reads and returns the config from disk.
// Returns nil, nil if the config file does not exist.
func Load() (*Config, error) {
	root, err := configRoot()
	if err != nil {
		return nil, fmt.Errorf("opening config root: %w", err)
	}
	defer root.Close()

	data, err := root.ReadFile("config.json")
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // no config exists
		}
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}

	return &cfg, nil
}

// Save persists the config to disk atomically via temp file + rename.
// Uses os.Root to confine file operations to the config directory.
func Save(cfg *Config) error {
	root, err := configRoot()
	if err != nil {
		return fmt.Errorf("opening config root: %w", err)
	}
	defer root.Close()

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling config: %w", err)
	}

	// Write to temp file then rename for atomicity
	if err := root.WriteFile("config.json.tmp", data, 0o600); err != nil {
		return fmt.Errorf("writing config file: %w", err)
	}

	if err := root.Rename("config.json.tmp", "config.json"); err != nil {
		_ = root.Remove("config.json.tmp") // cleanup on failure
		return fmt.Errorf("renaming config file: %w", err)
	}

	return nil
}

// Exists reports whether the config file exists on disk.
// Used to determine whether onboarding is needed.
func Exists() (bool, error) {
	root, err := configRoot()
	if err != nil {
		return false, fmt.Errorf("opening config root: %w", err)
	}
	defer root.Close()

	_, err = root.Stat("config.json")
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("checking config file: %w", err)
	}

	return true, nil
}
