package share

import (
	"bytes"
	"image"
	"image/png"

	"github.com/srlehn/termimg"
)

// DisplayInlineImage attempts to display an image inline in the terminal.
// Returns true if the terminal supports image display and it succeeded.
// Returns false silently if the terminal doesn't support images (AC3.6).
func DisplayInlineImage(img image.Image) bool {
	return tryTermImg(img)
}

// tryTermImg uses the go-termimg library to display the image.
func tryTermImg(img image.Image) bool {
	// Encode image to PNG bytes
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return false
	}

	// Use image.Rectangle as the bounds (full image bounds)
	bounds := img.Bounds()

	// Try to draw the image
	if err := termimg.DrawBytes(buf.Bytes(), bounds); err != nil {
		return false
	}

	return true
}
