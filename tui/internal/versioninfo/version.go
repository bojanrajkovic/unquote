// Package versioninfo provides build-time version information.
package versioninfo

import (
	"fmt"
	"runtime/debug"
	"strings"
)

// These variables are set via ldflags during build.
// Example: -ldflags "-X 'github.com/bojanrajkovic/unquote/tui/internal/versioninfo.Version=v1.0.0'"
var (
	Version = "dev"
	Branch  = ""
	Commit  = ""
	Date    = ""
)

// Info contains version and build information.
type Info struct {
	Version   string
	Branch    string
	Commit    string
	Date      string
	GoVersion string
	Modified  bool
}

// Get returns the current build information by combining
// ldflags-injected values with runtime/debug.BuildInfo.
// Ldflags values take precedence over debug.BuildInfo.
func Get() Info {
	info := Info{
		Version: Version,
		Branch:  Branch,
		Commit:  Commit,
		Date:    Date,
	}

	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return info
	}

	info.GoVersion = bi.GoVersion

	for _, s := range bi.Settings {
		switch s.Key {
		case "vcs.revision":
			if info.Commit == "" {
				info.Commit = s.Value
			}
		case "vcs.time":
			if info.Date == "" {
				info.Date = s.Value
			}
		case "vcs.modified":
			info.Modified = s.Value == "true"
		}
	}

	return info
}

// String returns a formatted version string suitable for display.
func (i Info) String() string {
	var parts []string

	parts = append(parts, fmt.Sprintf("unquote %s", i.Version))

	if i.Branch != "" {
		parts = append(parts, fmt.Sprintf("branch: %s", i.Branch))
	}

	if i.Commit != "" {
		commit := i.Commit
		if len(commit) > 12 {
			commit = commit[:12]
		}
		if i.Modified {
			commit += " (dirty)"
		}
		parts = append(parts, fmt.Sprintf("commit: %s", commit))
	}

	if i.Date != "" {
		parts = append(parts, fmt.Sprintf("built: %s", i.Date))
	}

	if i.GoVersion != "" {
		parts = append(parts, fmt.Sprintf("go: %s", i.GoVersion))
	}

	return strings.Join(parts, "\n")
}
