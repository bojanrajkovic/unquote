package puzzle

import "unicode"

// Cell represents a single character position in the puzzle
type Cell struct {
	Index    int  // Position in the original text
	Char     rune // The cipher character (encrypted)
	Input    rune // User's input (0 if empty)
	IsLetter bool // True if this cell is a letter (editable)
}

// BuildCells creates a slice of cells from encrypted text
func BuildCells(encryptedText string) []Cell {
	cells := make([]Cell, 0, len(encryptedText))

	for i, char := range encryptedText {
		cell := Cell{
			Index:    i,
			Char:     char,
			IsLetter: unicode.IsLetter(char),
		}
		cells = append(cells, cell)
	}

	return cells
}

// NextLetterCell finds the next editable cell index after the given position
// Returns -1 if no next letter cell exists
func NextLetterCell(cells []Cell, currentPos int) int {
	for i := currentPos + 1; i < len(cells); i++ {
		if cells[i].IsLetter {
			return i
		}
	}
	return -1
}

// NextUnfilledLetterCell finds the next editable cell that has no input yet
// Returns -1 if no unfilled letter cell exists after the current position
func NextUnfilledLetterCell(cells []Cell, currentPos int) int {
	for i := currentPos + 1; i < len(cells); i++ {
		if cells[i].IsLetter && cells[i].Input == 0 {
			return i
		}
	}
	return -1
}

// PrevLetterCell finds the previous editable cell index before the given position
// Returns -1 if no previous letter cell exists
func PrevLetterCell(cells []Cell, currentPos int) int {
	for i := currentPos - 1; i >= 0; i-- {
		if cells[i].IsLetter {
			return i
		}
	}
	return -1
}

// FirstLetterCell finds the first editable cell index
// Returns -1 if no letter cells exist
func FirstLetterCell(cells []Cell) int {
	for i, cell := range cells {
		if cell.IsLetter {
			return i
		}
	}
	return -1
}

// LastLetterCell finds the last editable cell index
// Returns -1 if no letter cells exist
func LastLetterCell(cells []Cell) int {
	for i := len(cells) - 1; i >= 0; i-- {
		if cells[i].IsLetter {
			return i
		}
	}
	return -1
}
