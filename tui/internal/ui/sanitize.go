package ui

import "strings"

// SanitizeString strips terminal control characters from a string,
// preserving tabs (0x09), newlines (0x0A), and carriage returns (0x0D).
// This prevents escape sequence injection from untrusted API responses.
func SanitizeString(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r == '\t', r == '\n', r == '\r':
			return r
		case r <= 0x08:
			return -1
		case r >= 0x0B && r <= 0x0C:
			return -1
		case r >= 0x0E && r <= 0x1F:
			return -1
		case r >= 0x7F && r <= 0x9F:
			return -1
		default:
			return r
		}
	}, s)
}
