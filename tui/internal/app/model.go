package app

import (
	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
)

// Minimum terminal dimensions
const (
	MinTerminalWidth  = 40
	MinTerminalHeight = 10
)

// State represents the application state
type State int

const (
	StateLoading State = iota
	StatePlaying
	StateChecking
	StateSolved
	StateError
)

// Model holds the application state
type Model struct {
	state     State
	puzzle    *api.Puzzle
	cells     []puzzle.Cell
	cursorPos int
	errorMsg  string
	statusMsg string
	width     int
	height    int
	sizeReady bool // true after first WindowSizeMsg received
	client    *api.Client
}

// New creates a new Model with initial state
func New() Model {
	return Model{
		state:  StateLoading,
		client: api.NewClient(),
	}
}

// NewWithClient creates a new Model with a custom API client (for testing)
func NewWithClient(client *api.Client) Model {
	return Model{
		state:  StateLoading,
		client: client,
	}
}

// IsTooSmall returns true if the terminal is too small for the UI
func (m Model) IsTooSmall() bool {
	return m.width < MinTerminalWidth || m.height < MinTerminalHeight
}
