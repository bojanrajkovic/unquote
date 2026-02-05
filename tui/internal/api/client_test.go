package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchTodaysPuzzle(t *testing.T) {
	expected := Puzzle{
		ID:            "test-game-id",
		Date:          "2026-02-03",
		EncryptedText: "YVCCB JBEYQ",
		Author:        "Test Author",
		Difficulty:    50,
		Hints: []Hint{
			{CipherLetter: "Y", PlainLetter: "H"},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/game/today" {
			t.Errorf("expected path /game/today, got %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("expected GET method, got %s", r.Method)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(expected)
	}))
	defer server.Close()

	client := NewClientWithURL(server.URL)
	puzzle, err := client.FetchTodaysPuzzle()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if puzzle.ID != expected.ID {
		t.Errorf("expected ID %q, got %q", expected.ID, puzzle.ID)
	}
	if puzzle.EncryptedText != expected.EncryptedText {
		t.Errorf("expected EncryptedText %q, got %q", expected.EncryptedText, puzzle.EncryptedText)
	}
	if len(puzzle.Hints) != 1 {
		t.Errorf("expected 1 hint, got %d", len(puzzle.Hints))
	}
}

func TestFetchTodaysPuzzle_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal server error"))
	}))
	defer server.Close()

	client := NewClientWithURL(server.URL)
	_, err := client.FetchTodaysPuzzle()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestFetchPuzzleByDate(t *testing.T) {
	expected := Puzzle{
		ID:            "date-game-id",
		Date:          "2026-01-15",
		EncryptedText: "GRFG CHMMRY",
		Author:        "Date Author",
		Difficulty:    30,
		Hints:         []Hint{},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/game/2026-01-15" {
			t.Errorf("expected path /game/2026-01-15, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(expected)
	}))
	defer server.Close()

	client := NewClientWithURL(server.URL)
	puzzle, err := client.FetchPuzzleByDate("2026-01-15")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if puzzle.Date != expected.Date {
		t.Errorf("expected Date %q, got %q", expected.Date, puzzle.Date)
	}
}

func TestCheckSolution_Correct(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/game/test-id/check" {
			t.Errorf("expected path /game/test-id/check, got %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST method, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		var req CheckRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if req.Solution != "HELLO WORLD" {
			t.Errorf("expected solution 'HELLO WORLD', got %q", req.Solution)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(CheckResponse{Correct: true})
	}))
	defer server.Close()

	client := NewClientWithURL(server.URL)
	result, err := client.CheckSolution("test-id", "HELLO WORLD")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Correct {
		t.Error("expected Correct to be true")
	}
}

func TestCheckSolution_Incorrect(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(CheckResponse{Correct: false})
	}))
	defer server.Close()

	client := NewClientWithURL(server.URL)
	result, err := client.CheckSolution("test-id", "WRONG ANSWER")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Correct {
		t.Error("expected Correct to be false")
	}
}

func TestCheckSolution_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte("game not found"))
	}))
	defer server.Close()

	client := NewClientWithURL(server.URL)
	_, err := client.CheckSolution("invalid-id", "TEST")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestNewClient_DefaultURL(t *testing.T) {
	client := NewClient()
	if client.baseURL != defaultBaseURL {
		t.Errorf("expected default URL %q, got %q", defaultBaseURL, client.baseURL)
	}
}
