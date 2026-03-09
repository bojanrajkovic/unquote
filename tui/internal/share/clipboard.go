package share

import (
	"fmt"
	"io"

	"github.com/atotto/clipboard"
)

// CopyToClipboard copies text to the system clipboard.
// If the clipboard is unavailable (SSH, headless, etc.), writes text to w
// with an explanatory message and returns false.
// Returns true if the clipboard write succeeded.
func CopyToClipboard(text string, w io.Writer) bool {
	if clipboard.Unsupported {
		fmt.Fprintln(w, "Clipboard not available. Here's the share text:")
		fmt.Fprintln(w)
		fmt.Fprintln(w, text)
		return false
	}

	if err := clipboard.WriteAll(text); err != nil {
		fmt.Fprintln(w, "Could not write to clipboard. Here's the share text:")
		fmt.Fprintln(w)
		fmt.Fprintln(w, text)
		return false
	}

	return true
}
