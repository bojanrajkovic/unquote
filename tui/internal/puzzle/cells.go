package puzzle

import "unicode"

// CellKind distinguishes between different types of cells in the puzzle grid.
type CellKind int

const (
	CellPunctuation CellKind = iota // Spaces, punctuation — not editable
	CellLetter                      // Regular letter — editable by player
	CellHint                        // Hint letter — prefilled, locked
)

// Cell represents a single character position in the puzzle
type Cell struct {
	Index int      // Position in the original text
	Char  rune     // The cipher character (encrypted)
	Input rune     // User's input (0 if empty)
	Kind  CellKind // Type of cell: punctuation, letter, or hint
}

// BuildCells creates a slice of cells from encrypted text.
// The hints map contains cipher-to-plain letter mappings. Cells whose cipher
// character appears in hints are created as CellHint with Input pre-set.
// Pass nil for no hints.
func BuildCells(encryptedText string, hints map[rune]rune) []Cell {
	cells := make([]Cell, 0, len(encryptedText))

	for i, char := range encryptedText {
		cell := Cell{
			Index: i,
			Char:  char,
		}

		if unicode.IsLetter(char) {
			if plain, ok := hints[char]; ok {
				cell.Kind = CellHint
				cell.Input = plain
			} else {
				cell.Kind = CellLetter
			}
		}
		// CellPunctuation is the zero value, no explicit assignment needed

		cells = append(cells, cell)
	}

	return cells
}

// NextLetterCell finds the next editable cell index after the given position
// Returns -1 if no next letter cell exists
func NextLetterCell(cells []Cell, currentPos int) int {
	for i := currentPos + 1; i < len(cells); i++ {
		if cells[i].Kind == CellLetter {
			return i
		}
	}
	return -1
}

// NextUnfilledLetterCell finds the next editable cell that has no input yet
// Returns -1 if no unfilled letter cell exists after the current position
func NextUnfilledLetterCell(cells []Cell, currentPos int) int {
	for i := currentPos + 1; i < len(cells); i++ {
		if cells[i].Kind == CellLetter && cells[i].Input == 0 {
			return i
		}
	}
	return -1
}

// PrevLetterCell finds the previous editable cell index before the given position
// Returns -1 if no previous letter cell exists
func PrevLetterCell(cells []Cell, currentPos int) int {
	for i := currentPos - 1; i >= 0; i-- {
		if cells[i].Kind == CellLetter {
			return i
		}
	}
	return -1
}

// FirstLetterCell finds the first editable cell index
// Returns -1 if no letter cells exist
func FirstLetterCell(cells []Cell) int {
	for i, cell := range cells {
		if cell.Kind == CellLetter {
			return i
		}
	}
	return -1
}

// LastLetterCell finds the last editable cell index
// Returns -1 if no letter cells exist
func LastLetterCell(cells []Cell) int {
	for i := len(cells) - 1; i >= 0; i-- {
		if cells[i].Kind == CellLetter {
			return i
		}
	}
	return -1
}
