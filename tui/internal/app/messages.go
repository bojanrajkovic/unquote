package app

import (
	"time"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/storage"
)

// puzzleFetchedMsg is sent when puzzle data has been loaded from the API
type puzzleFetchedMsg struct {
	puzzle *api.Puzzle
}

// solutionCheckedMsg is sent when the solution check returns from the API
type solutionCheckedMsg struct {
	correct bool
}

// errMsg is sent when an API error occurs
type errMsg struct {
	err error
}

// tickMsg is sent every second while the timer is running
type tickMsg time.Time

// sessionLoadedMsg is sent when a session has been loaded from storage
type sessionLoadedMsg struct {
	session *storage.GameSession
}
