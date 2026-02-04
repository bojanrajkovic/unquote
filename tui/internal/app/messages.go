package app

import "github.com/bojanrajkovic/unquote/tui/internal/api"

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
