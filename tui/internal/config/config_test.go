package config

import (
	"testing"

	"github.com/adrg/xdg"
)

// setConfigHome sets XDG_CONFIG_HOME to tmpDir and reloads xdg paths.
// Must be called before any config operations in tests.
func setConfigHome(t *testing.T, tmpDir string) {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", tmpDir)
	xdg.Reload()
	t.Cleanup(xdg.Reload) // restore xdg paths from real env after test
}

// TestLoadAndSave_ClaimCodeAndStatsEnabled verifies AC2.2:
// Save config with claim code and stats_enabled: true, load it back, verify fields match.
func TestLoadAndSave_ClaimCodeAndStatsEnabled(t *testing.T) {
	tmpDir := t.TempDir()
	setConfigHome(t, tmpDir)

	cfg := &Config{
		ClaimCode:    "ABC-123",
		StatsEnabled: true,
	}

	if err := Save(cfg); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if loaded == nil {
		t.Fatal("Load returned nil, expected config")
	}

	if loaded.ClaimCode != cfg.ClaimCode {
		t.Errorf("ClaimCode: expected %q, got %q", cfg.ClaimCode, loaded.ClaimCode)
	}
	if loaded.StatsEnabled != cfg.StatsEnabled {
		t.Errorf("StatsEnabled: expected %v, got %v", cfg.StatsEnabled, loaded.StatsEnabled)
	}
}

// TestLoadAndSave_StatsDisabled verifies AC2.3:
// Save config with stats_enabled: false, load it back, verify field is false.
func TestLoadAndSave_StatsDisabled(t *testing.T) {
	tmpDir := t.TempDir()
	setConfigHome(t, tmpDir)

	cfg := &Config{
		ClaimCode:    "",
		StatsEnabled: false,
	}

	if err := Save(cfg); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if loaded == nil {
		t.Fatal("Load returned nil, expected config")
	}

	if loaded.StatsEnabled != false {
		t.Errorf("StatsEnabled: expected false, got %v", loaded.StatsEnabled)
	}
}

// TestExists verifies AC2.4:
// Exists() returns false when no config file, true after save.
func TestExists(t *testing.T) {
	tmpDir := t.TempDir()
	setConfigHome(t, tmpDir)

	// No config file yet
	exists, err := Exists()
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	if exists {
		t.Error("Exists() should return false when no config file exists")
	}

	// Save a config
	cfg := &Config{
		ClaimCode:    "DEF-456",
		StatsEnabled: true,
	}
	if saveErr := Save(cfg); saveErr != nil {
		t.Fatalf("Save failed: %v", saveErr)
	}

	// Should exist now
	exists, err = Exists()
	if err != nil {
		t.Fatalf("Exists failed after save: %v", err)
	}
	if !exists {
		t.Error("Exists() should return true after saving config")
	}
}

// TestLoad_MissingFile verifies that Load returns nil, nil when no config exists.
func TestLoad_MissingFile(t *testing.T) {
	tmpDir := t.TempDir()
	setConfigHome(t, tmpDir)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load should not error for missing file: %v", err)
	}
	if cfg != nil {
		t.Error("Load should return nil for missing file")
	}
}
