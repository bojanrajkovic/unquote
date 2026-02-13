package app

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/storage"
)

// fetchPuzzleCmd creates a command to fetch today's puzzle
func fetchPuzzleCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		puzzle, err := client.FetchTodaysPuzzle()
		if err != nil {
			return errMsg{err: err}
		}
		return puzzleFetchedMsg{puzzle: puzzle}
	}
}

// checkSolutionCmd creates a command to check the user's solution
func checkSolutionCmd(client *api.Client, gameID, solution string) tea.Cmd {
	return func() tea.Msg {
		result, err := client.CheckSolution(gameID, solution)
		if err != nil {
			return errMsg{err: err}
		}
		return solutionCheckedMsg{correct: result.Correct}
	}
}

// tickCmd creates a command that fires a tickMsg after one second
func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

// loadSessionCmd creates a command to load a saved session for a game
func loadSessionCmd(gameID string) tea.Cmd {
	return func() tea.Msg {
		session, err := storage.LoadSession(gameID)
		if err != nil {
			// Silently treat errors as "no session" - persistence is best-effort
			// and shouldn't block gameplay. LoadSession already returns nil for
			// missing files, so errors here are unexpected (e.g., corrupt JSON).
			return sessionLoadedMsg{session: nil}
		}
		return sessionLoadedMsg{session: session}
	}
}

// saveSessionCmd creates a command to save the current session state
func saveSessionCmd(gameID string, cells []puzzle.Cell, elapsed time.Duration) tea.Cmd {
	return func() tea.Msg {
		// Build inputs map from cells - only store unique cipher->input mappings
		inputs := make(map[string]string)
		for _, cell := range cells {
			if cell.Kind == puzzle.CellLetter && cell.Input != 0 {
				inputs[string(cell.Char)] = string(cell.Input)
			}
		}

		session := &storage.GameSession{
			GameID:      gameID,
			Inputs:      inputs,
			ElapsedTime: elapsed,
			Solved:      false,
		}

		// Silently ignore errors - persistence is best-effort and shouldn't
		// interrupt gameplay. File system errors are rare and non-critical.
		_ = storage.SaveSession(session)
		return nil
	}
}

// saveSolvedSessionCmd creates a command to save the solved session state
func saveSolvedSessionCmd(gameID string, cells []puzzle.Cell, completionTime time.Duration) tea.Cmd {
	return func() tea.Msg {
		// Build inputs map from cells
		inputs := make(map[string]string)
		for _, cell := range cells {
			if cell.Kind == puzzle.CellLetter && cell.Input != 0 {
				inputs[string(cell.Char)] = string(cell.Input)
			}
		}

		session := &storage.GameSession{
			GameID:         gameID,
			Inputs:         inputs,
			ElapsedTime:    completionTime,
			Solved:         true,
			CompletionTime: completionTime,
		}

		// Silently ignore errors - persistence is best-effort and shouldn't
		// interrupt the celebration of solving. File system errors are rare.
		_ = storage.SaveSession(session)
		return nil
	}
}
