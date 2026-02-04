package app

import (
	"testing"
	"time"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/puzzle"
	"github.com/bojanrajkovic/unquote/tui/internal/storage"
)

func TestHandleSessionLoaded_RestoresInputs(t *testing.T) {
	// Create a model with cells
	encryptedText := "XMT KTQS"
	model := Model{
		puzzle: &api.Puzzle{
			ID:            "test-game",
			EncryptedText: encryptedText,
		},
		cells:     puzzle.BuildCells(encryptedText),
		state:     StatePlaying,
		startTime: time.Now(),
	}

	// Create a session with saved inputs
	session := &storage.GameSession{
		GameID: "test-game",
		Inputs: map[string]string{
			"X": "Y",
			"M": "O",
			"T": "U",
			"K": "M",
			"Q": "S",
			"S": "T",
		},
		ElapsedTime: 30 * time.Second,
		Solved:      false,
	}

	// Call handleSessionLoaded
	msg := sessionLoadedMsg{session: session}
	resultModel, _ := model.handleSessionLoaded(msg)
	m := resultModel.(Model)

	// Verify inputs were restored
	expectedInputs := map[rune]rune{
		'X': 'Y',
		'M': 'O',
		'T': 'U',
		'K': 'M',
		'Q': 'S',
		'S': 'T',
	}

	for i, cell := range m.cells {
		if !cell.IsLetter {
			continue
		}
		expectedInput, ok := expectedInputs[cell.Char]
		if !ok {
			t.Errorf("Cell %d: unexpected cipher char %c", i, cell.Char)
			continue
		}
		if cell.Input != expectedInput {
			t.Errorf("Cell %d (cipher=%c): expected input %c, got %c", i, cell.Char, expectedInput, cell.Input)
		}
	}

	// Verify elapsed time was restored
	if m.elapsedAtPause != 30*time.Second {
		t.Errorf("ElapsedAtPause: expected %v, got %v", 30*time.Second, m.elapsedAtPause)
	}
}

func TestFullFlow_PuzzleFetchThenSessionLoad(t *testing.T) {
	// Simulate the full flow: puzzle fetched -> session loaded
	encryptedText := "XMT KTQS"

	// Start with empty model
	model := Model{
		state: StateLoading,
	}

	// Simulate puzzleFetchedMsg
	puzzleMsg := puzzleFetchedMsg{
		puzzle: &api.Puzzle{
			ID:            "test-game",
			EncryptedText: encryptedText,
		},
	}
	resultModel, cmd := model.handlePuzzleFetched(puzzleMsg)
	model = resultModel.(Model)

	// Verify cells were created
	if len(model.cells) != 8 {
		t.Fatalf("Expected 8 cells, got %d", len(model.cells))
	}

	// Verify a command was returned (loadSessionCmd)
	if cmd == nil {
		t.Fatal("Expected loadSessionCmd to be returned")
	}

	// Now simulate sessionLoadedMsg (as if loadSessionCmd completed)
	session := &storage.GameSession{
		GameID: "test-game",
		Inputs: map[string]string{
			"X": "Y",
			"M": "O",
			"T": "U",
			"K": "M",
			"Q": "S",
			"S": "T",
		},
		ElapsedTime: 30 * time.Second,
		Solved:      false,
	}

	sessionMsg := sessionLoadedMsg{session: session}
	resultModel, _ = model.handleSessionLoaded(sessionMsg)
	model = resultModel.(Model)

	// Verify inputs were restored in the model
	expectedInputs := map[rune]rune{
		'X': 'Y',
		'M': 'O',
		'T': 'U',
		'K': 'M',
		'Q': 'S',
		'S': 'T',
	}

	for i, cell := range model.cells {
		if !cell.IsLetter {
			continue
		}
		expectedInput, ok := expectedInputs[cell.Char]
		if !ok {
			t.Errorf("Cell %d: unexpected cipher char %c", i, cell.Char)
			continue
		}
		if cell.Input != expectedInput {
			t.Errorf("Cell %d (cipher=%c): expected input %c, got %c", i, cell.Char, expectedInput, cell.Input)
		}
	}

	t.Logf("All cells after session restore:")
	for i, cell := range model.cells {
		t.Logf("  Cell %d: Char=%c, IsLetter=%v, Input=%c", i, cell.Char, cell.IsLetter, cell.Input)
	}
}

func TestHandleSessionLoaded_SolvedSessionRestoresInputs(t *testing.T) {
	// This tests the bug fix: solved sessions must also restore inputs
	encryptedText := "XMT KTQS"
	model := Model{
		puzzle: &api.Puzzle{
			ID:            "test-game",
			EncryptedText: encryptedText,
		},
		cells:     puzzle.BuildCells(encryptedText),
		state:     StatePlaying,
		startTime: time.Now(),
	}

	// Create a SOLVED session with inputs
	session := &storage.GameSession{
		GameID: "test-game",
		Inputs: map[string]string{
			"X": "Y",
			"M": "O",
			"T": "U",
			"K": "M",
			"Q": "S",
			"S": "T",
		},
		ElapsedTime:    30 * time.Second,
		Solved:         true, // KEY: session is marked as solved
		CompletionTime: 30 * time.Second,
	}

	msg := sessionLoadedMsg{session: session}
	resultModel, _ := model.handleSessionLoaded(msg)
	m := resultModel.(Model)

	// Verify state is solved
	if m.state != StateSolved {
		t.Errorf("State should be StateSolved, got %v", m.state)
	}

	// Verify inputs were STILL restored even for solved session
	expectedInputs := map[rune]rune{
		'X': 'Y',
		'M': 'O',
		'T': 'U',
		'K': 'M',
		'Q': 'S',
		'S': 'T',
	}

	for i, cell := range m.cells {
		if !cell.IsLetter {
			continue
		}
		expectedInput, ok := expectedInputs[cell.Char]
		if !ok {
			t.Errorf("Cell %d: unexpected cipher char %c", i, cell.Char)
			continue
		}
		if cell.Input != expectedInput {
			t.Errorf("Cell %d (cipher=%c): expected input %c, got %c", i, cell.Char, expectedInput, cell.Input)
		}
	}
}

func TestUpdate_SessionLoadedRestoresInputs(t *testing.T) {
	// This test uses the Update function directly like Bubble Tea does
	encryptedText := "XMT KTQS"

	// Create initial model after puzzle fetch
	model := Model{
		puzzle: &api.Puzzle{
			ID:            "test-game",
			EncryptedText: encryptedText,
		},
		cells:     puzzle.BuildCells(encryptedText),
		state:     StatePlaying,
		startTime: time.Now(),
	}

	// Verify cells start with no input
	for i, cell := range model.cells {
		if cell.IsLetter && cell.Input != 0 {
			t.Errorf("Cell %d should start with no input, got %c", i, cell.Input)
		}
	}

	// Simulate sessionLoadedMsg through Update (like Bubble Tea does)
	session := &storage.GameSession{
		GameID: "test-game",
		Inputs: map[string]string{
			"X": "Y",
			"M": "O",
			"T": "U",
			"K": "M",
			"Q": "S",
			"S": "T",
		},
		ElapsedTime: 30 * time.Second,
		Solved:      false,
	}

	sessionMsg := sessionLoadedMsg{session: session}
	resultModel, _ := model.Update(sessionMsg)
	updatedModel := resultModel.(Model)

	// Verify inputs were restored in the returned model
	expectedInputs := map[rune]rune{
		'X': 'Y',
		'M': 'O',
		'T': 'U',
		'K': 'M',
		'Q': 'S',
		'S': 'T',
	}

	t.Log("Cells in ORIGINAL model after Update:")
	for i, cell := range model.cells {
		if cell.IsLetter {
			t.Logf("  Cell %d: Char=%c, Input=%c", i, cell.Char, cell.Input)
		}
	}

	t.Log("Cells in RETURNED model after Update:")
	for i, cell := range updatedModel.cells {
		if cell.IsLetter {
			t.Logf("  Cell %d: Char=%c, Input=%c", i, cell.Char, cell.Input)
		}
	}

	for i, cell := range updatedModel.cells {
		if !cell.IsLetter {
			continue
		}
		expectedInput, ok := expectedInputs[cell.Char]
		if !ok {
			t.Errorf("Cell %d: unexpected cipher char %c", i, cell.Char)
			continue
		}
		if cell.Input != expectedInput {
			t.Errorf("Cell %d (cipher=%c): expected input %c, got %c", i, cell.Char, expectedInput, cell.Input)
		}
	}
}
