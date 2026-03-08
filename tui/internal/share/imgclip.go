package share

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"os"
	"os/exec"
	"runtime"
)

// CopyImageToClipboard encodes the image as PNG and copies it to the system
// image clipboard using platform-specific commands.
//
// Returns true if the copy succeeded, false if the clipboard command is
// unavailable or fails.
func CopyImageToClipboard(img image.Image) bool {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return false
	}

	switch runtime.GOOS {
	case "linux":
		return copyImageLinux(buf.Bytes())
	case "darwin":
		return copyImageDarwin(buf.Bytes())
	default:
		return false
	}
}

// copyImageLinux uses xclip to write PNG data to the X11 clipboard.
func copyImageLinux(data []byte) bool {
	cmd := exec.Command("xclip", "-selection", "clipboard", "-t", "image/png")
	cmd.Stdin = bytes.NewReader(data)
	return cmd.Run() == nil
}

// copyImageDarwin uses osascript to write PNG data to the macOS clipboard.
// Writes to a temp file first since pbcopy doesn't support binary data directly.
func copyImageDarwin(data []byte) bool {
	// Write to temp file, then use osascript to set clipboard
	tmpFile, err := os.CreateTemp("", "unquote-share-*.png")
	if err != nil {
		return false
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return false
	}
	tmpFile.Close()

	// Use osascript with file argument to avoid command injection
	// nolint: gosec // tmpPath is from os.CreateTemp, not user input
	script := fmt.Sprintf(`set the clipboard to (read (POSIX file "%s") as «class PNGf»)`, tmpPath)
	cmd := exec.Command("osascript", "-e", script) // nolint: gosec // tmpPath is from os.CreateTemp
	return cmd.Run() == nil
}
