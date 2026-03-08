package share

import (
	"bytes"
	"testing"
)

// Test CopyToClipboard returns true on success
func TestCopyToClipboard_Success(t *testing.T) {
	// This test is difficult to fully verify without a real clipboard.
	// We test that the function executes without error for a supported system.
	// On systems without clipboard support, this will test the fallback.
	var buf bytes.Buffer
	text := "Test share text"

	result := CopyToClipboard(text, &buf)

	// Result should be true on systems with clipboard support, false on headless/SSH
	// We don't assert the result, just that the function runs without panic
	_ = result

	// On unsupported systems, text should be written to buffer
	if result == false {
		output := buf.String()
		if !contains(output, text) {
			t.Errorf("expected fallback text in output, got: %q", output)
		}
	}
}

// Test CopyToClipboard writes to output on fallback
func TestCopyToClipboard_FallbackWritesText(t *testing.T) {
	// This test verifies that when clipboard fails, we still write to the output writer
	var buf bytes.Buffer
	text := "Share this text"

	// We can't easily simulate clipboard failure in a unit test,
	// so we just verify the function is callable and doesn't panic
	result := CopyToClipboard(text, &buf)

	// If clipboard is unsupported, verify output contains the text
	if !result && buf.Len() == 0 {
		t.Errorf("expected fallback output when clipboard is unavailable")
	}
}

// Test CopyToClipboard with empty text
func TestCopyToClipboard_EmptyText(_ *testing.T) {
	var buf bytes.Buffer

	result := CopyToClipboard("", &buf)

	// Function should handle empty text gracefully
	_ = result
}

// Test CopyToClipboard with multiline text
func TestCopyToClipboard_MultilineText(t *testing.T) {
	var buf bytes.Buffer
	text := "Line 1\nLine 2\nLine 3"

	result := CopyToClipboard(text, &buf)

	// If using fallback, verify multiline text is preserved
	if !result {
		output := buf.String()
		if !contains(output, "Line 1") || !contains(output, "Line 2") {
			t.Errorf("multiline text not preserved in fallback")
		}
	}
}
