package ui

import "github.com/charmbracelet/lipgloss"

// Colors
var (
	ColorPrimary   = lipgloss.Color("63")  // Purple
	ColorSecondary = lipgloss.Color("86")  // Aqua
	ColorSuccess   = lipgloss.Color("42")  // Green
	ColorError     = lipgloss.Color("196") // Red
	ColorMuted     = lipgloss.Color("245") // Gray
	ColorWhite     = lipgloss.Color("15")  // White
	ColorWarning   = lipgloss.Color("214") // Orange
)

// HeaderStyle renders the main title header
var HeaderStyle = lipgloss.NewStyle().
	Bold(true).
	Foreground(ColorWhite).
	Background(ColorPrimary).
	Align(lipgloss.Center).
	Padding(1, 2)

// DifficultyStyle renders the difficulty indicator
var DifficultyStyle = lipgloss.NewStyle().
	Foreground(ColorMuted).
	Align(lipgloss.Center)

// HintStyle renders the hint clues
var HintStyle = lipgloss.NewStyle().
	Foreground(ColorSecondary).
	Italic(true).
	PaddingLeft(2)

// CellStyle renders a single puzzle cell (user input)
var CellStyle = lipgloss.NewStyle().
	Width(3).
	Align(lipgloss.Center)

// ActiveCellStyle renders the currently focused cell
var ActiveCellStyle = CellStyle.
	Foreground(ColorPrimary).
	Background(ColorWhite).
	Bold(true)

// RelatedCellStyle highlights cells sharing the same cipher letter as the active cell.
// Uses background tint without bold to differentiate from ActiveCellStyle.
var RelatedCellStyle = CellStyle.
	Background(lipgloss.Color("236"))

// DuplicateInputStyle highlights cells where the player's input letter
// is also assigned to a different ciphertext letter (conflict warning).
var DuplicateInputStyle = CellStyle.
	Background(ColorWarning).
	Foreground(lipgloss.Color("16"))

// HintCellStyle renders prefilled hint cells with cyan foreground.
// Visually connects to the "Clues:" text above the grid.
var HintCellStyle = CellStyle.
	Foreground(ColorSecondary)

// CipherStyle renders the cipher letter below input
var CipherStyle = lipgloss.NewStyle().
	Width(3).
	Align(lipgloss.Center).
	Foreground(ColorMuted)

// AuthorStyle renders the quote author
var AuthorStyle = lipgloss.NewStyle().
	Foreground(ColorMuted).
	Italic(true).
	Align(lipgloss.Right).
	PaddingTop(1)

// HelpStyle renders the help bar at bottom
var HelpStyle = lipgloss.NewStyle().
	Foreground(ColorMuted).
	PaddingTop(1)

// ErrorStyle renders error messages
var ErrorStyle = lipgloss.NewStyle().
	Foreground(ColorError).
	Bold(true)

// SuccessStyle renders success messages
var SuccessStyle = lipgloss.NewStyle().
	Foreground(ColorSuccess).
	Bold(true)

// LoadingStyle renders loading indicator
var LoadingStyle = lipgloss.NewStyle().
	Foreground(ColorSecondary)

// TimerStyle renders the elapsed time display
var TimerStyle = lipgloss.NewStyle().
	Foreground(ColorMuted)
