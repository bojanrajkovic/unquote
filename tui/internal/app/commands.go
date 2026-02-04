package app

import (
	tea "github.com/charmbracelet/bubbletea"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
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
