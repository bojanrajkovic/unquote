package app

import (
	"fmt"
	"time"

	"github.com/charmbracelet/huh"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/config"
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
	StateOnboarding
	StateClaimCodeDisplay
	StateStats
)

// Options configures the application behavior.
type Options struct {
	Insecure  bool
	Random    bool
	StatsMode bool
}

// Model holds the application state
type Model struct {
	startTime      time.Time
	form           *huh.Form // huh form for onboarding (nil when not in onboarding)
	puzzle         *api.Puzzle
	client         *api.Client
	cfg            *config.Config
	stats          *api.PlayerStatsResponse // stats data from API (nil until fetched)
	claimCode      string                   // claim code after registration
	errorMsg       string
	statusMsg      string
	loadingMsg     string // context-specific loading message
	cells          []puzzle.Cell
	elapsedAtPause time.Duration
	state          State
	cursorPos      int
	width          int
	height         int
	opts           Options
	optIn          bool // bound to huh.Confirm value
	sizeReady      bool
	statsOnly      bool // true when launched via `unquote stats` subcommand
}

// New creates a new Model with initial state
func New(opts Options) (Model, error) {
	client, err := api.NewClient(opts.Insecure)
	if err != nil {
		return Model{}, fmt.Errorf("creating API client: %w", err)
	}
	return Model{
		state:  StateLoading,
		client: client,
		opts:   opts,
	}, nil
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
