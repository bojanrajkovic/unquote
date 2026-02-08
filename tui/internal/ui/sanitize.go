package ui

import (
	"strings"
	"unicode"
)

// SanitizeString strips terminal control characters from a string,
// preserving tabs (0x09), newlines (0x0A), and carriage returns (0x0D).
// This prevents escape sequence injection from untrusted API responses.
func SanitizeString(s string) string {
	return strings.Map(func(r rune) rune {
		if r == '\t' || r == '\n' || r == '\r' {
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
}
