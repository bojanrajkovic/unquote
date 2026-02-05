package app

import (
	"time"

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
	state          State
	puzzle         *api.Puzzle
	cells          []puzzle.Cell
	cursorPos      int
	errorMsg       string
	statusMsg      string
	width          int
	height         int
	sizeReady      bool // true after first WindowSizeMsg received
	client         *api.Client
	startTime      time.Time     // when current timer run started
	elapsedAtPause time.Duration // accumulated time before pause/solve
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

// Elapsed returns the total elapsed time for the current puzzle.
// While playing, it calculates from startTime; when paused/solved, returns accumulated time.
func (m Model) Elapsed() time.Duration {
	if m.state == StatePlaying {
		return m.elapsedAtPause + time.Since(m.startTime)
	}
	return m.elapsedAtPause
}
