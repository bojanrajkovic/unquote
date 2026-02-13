package puzzle

import "strings"

// AssembleSolution combines user input with original punctuation/spaces
// to create the full solution string for API validation
func AssembleSolution(cells []Cell) string {
	var builder strings.Builder
	builder.Grow(len(cells))

	for _, cell := range cells {
		if cell.Kind == CellLetter {
			if cell.Input != 0 {
				builder.WriteRune(cell.Input)
			} else {
				builder.WriteRune('_')
			}
		} else {
			builder.WriteRune(cell.Char)
		}
	}

	return builder.String()
}

// IsComplete checks if all letter cells have been filled in
func IsComplete(cells []Cell) bool {
	for _, cell := range cells {
		if cell.Kind == CellLetter && cell.Input == 0 {
			return false
		}
	}
	return true
}

// ClearAllInput resets all user input in the cells
func ClearAllInput(cells []Cell) {
	for i := range cells {
		cells[i].Input = 0
	}
}

// SetInput sets the user input for a specific cell index and propagates
// to all cells with the same cipher character.
// Returns false if the index is out of bounds or the cell is not a letter.
func SetInput(cells []Cell, index int, input rune) bool {
	if index < 0 || index >= len(cells) {
		return false
	}
	if cells[index].Kind != CellLetter {
		return false
	}

	cipherChar := cells[index].Char
	for i := range cells {
		if cells[i].Kind == CellLetter && cells[i].Char == cipherChar {
			cells[i].Input = input
		}
	}
	return true
}

// ClearInput clears the user input for a specific cell index and propagates
// to all cells with the same cipher character.
// Returns false if the index is out of bounds or the cell is not a letter.
func ClearInput(cells []Cell, index int) bool {
	return SetInput(cells, index, 0)
}
