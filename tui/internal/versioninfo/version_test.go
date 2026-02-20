package versioninfo

import (
	"strings"
	"testing"
)

func TestGetReturnsDefaultValues(t *testing.T) {
	info := Get()

	if info.Version != Version {
		t.Errorf("Version = %q, want %q", info.Version, Version)
	}
	if info.Branch != Branch {
		t.Errorf("Branch = %q, want %q", info.Branch, Branch)
	}
}

func TestInfoString(t *testing.T) {
	tests := []struct {
		name     string
		info     Info
		contains []string
	}{
		{
			name: "version only",
			info: Info{Version: "v1.0.0"},
			contains: []string{
				"unquote v1.0.0",
			},
		},
		{
			name: "with branch",
			info: Info{Version: "v1.0.0", Branch: "main"},
			contains: []string{
				"unquote v1.0.0",
				"branch: main",
			},
		},
		{
			name: "with commit truncation",
			info: Info{Version: "v1.0.0", Commit: "abcdef1234567890"},
			contains: []string{
				"commit: abcdef123456",
			},
		},
		{
			name: "with short commit no truncation",
			info: Info{Version: "v1.0.0", Commit: "abcdef12"},
			contains: []string{
				"commit: abcdef12",
			},
		},
		{
			name: "dirty flag appends marker",
			info: Info{Version: "v1.0.0", Commit: "abcdef12", Modified: true},
			contains: []string{
				"commit: abcdef12 (dirty)",
			},
		},
		{
			name: "with date",
			info: Info{Version: "v1.0.0", Date: "2026-02-04T12:00:00Z"},
			contains: []string{
				"built: 2026-02-04T12:00:00Z",
			},
		},
		{
			name: "with go version",
			info: Info{Version: "v1.0.0", GoVersion: "go1.25.6"},
			contains: []string{
				"go: go1.25.6",
			},
		},
		{
			name: "full info",
			info: Info{
				Version:   "v1.0.0",
				Branch:    "main",
				Commit:    "abcdef1234567890",
				Date:      "2026-02-04T12:00:00Z",
				GoVersion: "go1.25.6",
				Modified:  false,
			},
			contains: []string{
				"unquote v1.0.0",
				"branch: main",
				"commit: abcdef123456",
				"built: 2026-02-04T12:00:00Z",
				"go: go1.25.6",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.info.String()
			for _, want := range tt.contains {
				if !strings.Contains(result, want) {
					t.Errorf("String() = %q, want to contain %q", result, want)
				}
			}
		})
	}
}

func TestInfoStringOmitsEmptyFields(t *testing.T) {
	info := Info{Version: "v1.0.0"}
	result := info.String()

	// Should not contain labels for empty fields
	if strings.Contains(result, "branch:") {
		t.Error("String() should not contain 'branch:' when Branch is empty")
	}
	if strings.Contains(result, "commit:") {
		t.Error("String() should not contain 'commit:' when Commit is empty")
	}
	if strings.Contains(result, "built:") {
		t.Error("String() should not contain 'built:' when Date is empty")
	}
	if strings.Contains(result, "go:") {
		t.Error("String() should not contain 'go:' when GoVersion is empty")
	}
}
