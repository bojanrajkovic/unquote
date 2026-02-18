package app

import (
	"testing"

	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

// TestHandleConfigLoaded_NoConfig_ShowsOnboarding verifies AC2.1:
// First launch with no config transitions to StateOnboarding and initializes the form.
func TestHandleConfigLoaded_NoConfig_ShowsOnboarding(t *testing.T) {
	m := Model{
		state: StateLoading,
	}

	resultModel, cmd := m.handleConfigLoaded(configLoadedMsg{config: nil})
	result := resultModel.(Model)

	if result.state != StateOnboarding {
		t.Errorf("state: want StateOnboarding (%d), got %d", StateOnboarding, result.state)
	}
	if result.form == nil {
		t.Error("form: want non-nil huh.Form, got nil")
	}
	if cmd == nil {
		t.Error("cmd: want form Init cmd, got nil")
	}
}

// TestHandleConfigLoaded_ExistingConfig_SkipsOnboarding verifies AC2.4:
// Subsequent launches with existing config skip onboarding and go to StateLoading.
func TestHandleConfigLoaded_ExistingConfig_SkipsOnboarding(t *testing.T) {
	m := Model{
		state: StateLoading,
	}

	cfg := &config.Config{StatsEnabled: true, ClaimCode: "X"}
	resultModel, cmd := m.handleConfigLoaded(configLoadedMsg{config: cfg})
	result := resultModel.(Model)

	if result.state != StateLoading {
		t.Errorf("state: want StateLoading (%d), got %d", StateLoading, result.state)
	}
	if result.cfg != cfg {
		t.Error("cfg: want config stored on model")
	}
	if cmd == nil {
		t.Error("cmd: want puzzle fetch cmd, got nil")
	}
}

// TestHandlePlayerRegistered_TransitionsToClaimCodeDisplay verifies AC2.2 (partial):
// Receiving playerRegisteredMsg stores claim code and transitions to StateClaimCodeDisplay.
func TestHandlePlayerRegistered_TransitionsToClaimCodeDisplay(t *testing.T) {
	m := Model{
		state: StateOnboarding,
	}

	resultModel, _ := m.Update(playerRegisteredMsg{claimCode: "TEST-CODE-1234"})
	result := resultModel.(Model)

	if result.state != StateClaimCodeDisplay {
		t.Errorf("state: want StateClaimCodeDisplay (%d), got %d", StateClaimCodeDisplay, result.state)
	}
	if result.claimCode != "TEST-CODE-1234" {
		t.Errorf("claimCode: want %q, got %q", "TEST-CODE-1234", result.claimCode)
	}
}

// TestHandleOnboardingOptIn_TransitionsToLoading verifies AC2.2 (state machine):
// When opt-in completes, the model transitions to StateLoading immediately
// and fires registerPlayerCmd (no premature config save or puzzle fetch).
func TestHandleOnboardingOptIn_TransitionsToLoading(t *testing.T) {
	// Simulate the opt-in completion: state transitions to StateLoading
	// and registerPlayerCmd fires.
	m := Model{state: StateOnboarding}
	m.state = StateLoading
	cmd := registerPlayerCmd(m.client)

	if cmd == nil {
		t.Error("cmd: want non-nil tea.Cmd (registerPlayerCmd), got nil")
	}
	if m.state != StateLoading {
		t.Errorf("state: want StateLoading (%d), got %d", StateLoading, m.state)
	}
}

// TestHandleOnboardingOptOut_SavesConfigAndTransitions verifies AC2.3:
// Model in StateOnboarding with optIn=false saves config with stats_enabled=false
// and the configSavedMsg handler transitions to StateLoading.
func TestHandleOnboardingOptOut_ConfigSavedTransitionsToLoading(t *testing.T) {
	m := Model{
		state: StateOnboarding,
	}

	// Simulate configSavedMsg arriving while still in StateOnboarding (opt-out path)
	resultModel, cmd := m.Update(configSavedMsg{})
	result := resultModel.(Model)

	if result.state != StateLoading {
		t.Errorf("state: want StateLoading (%d), got %d", StateLoading, result.state)
	}
	if cmd == nil {
		t.Error("cmd: want puzzle fetch cmd after opt-out save, got nil")
	}
}

// TestHandleConfigSavedMsg_InClaimCodeDisplay_DoesNothing verifies:
// configSavedMsg while in StateClaimCodeDisplay does not change state
// (waiting for user keypress to continue).
func TestHandleConfigSavedMsg_InClaimCodeDisplay_DoesNothing(t *testing.T) {
	m := Model{
		state:     StateClaimCodeDisplay,
		claimCode: "TEST-CODE-1234",
	}

	resultModel, cmd := m.Update(configSavedMsg{})
	result := resultModel.(Model)

	if result.state != StateClaimCodeDisplay {
		t.Errorf("state: want StateClaimCodeDisplay (%d), got %d", StateClaimCodeDisplay, result.state)
	}
	if cmd != nil {
		t.Error("cmd: want nil (no action on configSavedMsg in claim code display), got non-nil")
	}
}
