package ui

import "testing"

func TestSanitizeString(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "plain text unchanged",
			input: "Hello, World!",
			want:  "Hello, World!",
		},
		{
			name:  "preserves tabs",
			input: "col1\tcol2",
			want:  "col1\tcol2",
		},
		{
			name:  "preserves newlines",
			input: "line1\nline2",
			want:  "line1\nline2",
		},
		{
			name:  "preserves carriage returns",
			input: "line1\r\nline2",
			want:  "line1\r\nline2",
		},
		{
			name:  "strips null byte",
			input: "hel\x00lo",
			want:  "hello",
		},
		{
			name:  "strips escape sequence",
			input: "normal\x1b[31mred\x1b[0mnormal",
			want:  "normal[31mred[0mnormal",
		},
		{
			name:  "strips bell character",
			input: "alert\x07here",
			want:  "alerthere",
		},
		{
			name:  "strips backspace",
			input: "back\x08space",
			want:  "backspace",
		},
		{
			name:  "strips DEL",
			input: "del\x7fete",
			want:  "delete",
		},
		{
			name:  "strips C1 control characters",
			input: "c1\u0080\u008f\u009fend",
			want:  "c1end",
		},
		{
			name:  "preserves unicode",
			input: "héllo wörld 日本語",
			want:  "héllo wörld 日本語",
		},
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "strips form feed and vertical tab",
			input: "form\x0cfeed\x0bvtab",
			want:  "formfeedvtab",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeString(tt.input)
			if got != tt.want {
				t.Errorf("SanitizeString(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
