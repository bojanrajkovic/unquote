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

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
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

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	_, err = client.FetchTodaysPuzzle()
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

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
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

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
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

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
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

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	_, err = client.CheckSolution("invalid-id", "TEST")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestNewClient_DefaultURL(t *testing.T) {
	// Default URL is HTTPS, so insecure=false should work
	client, err := NewClient(false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client.baseURL != defaultBaseURL {
		t.Errorf("expected default URL %q, got %q", defaultBaseURL, client.baseURL)
	}
}

func TestNewClientWithURL_RejectsInsecureHTTP(t *testing.T) {
	// HTTP to non-localhost should fail when insecure=false
	_, err := NewClientWithURL("http://example.com", false)
	if err == nil {
		t.Fatal("expected error for insecure HTTP to non-localhost")
	}
}

func TestNewClientWithURL_AllowsInsecureHTTPWithFlag(t *testing.T) {
	// HTTP to non-localhost should succeed when insecure=true
	client, err := NewClientWithURL("http://example.com", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if client.baseURL != "http://example.com" {
		t.Errorf("expected base URL %q, got %q", "http://example.com", client.baseURL)
	}
}

func TestNewClientWithURL_AllowsLocalhostHTTP(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"localhost", "http://localhost:3000"},
		{"127.0.0.1", "http://127.0.0.1:3000"},
		{"ipv6-loopback", "http://[::1]:3000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClientWithURL(tt.url, false)
			if err != nil {
				t.Fatalf("localhost HTTP should be allowed: %v", err)
			}
			if client.baseURL != tt.url {
				t.Errorf("expected base URL %q, got %q", tt.url, client.baseURL)
			}
		})
	}
}

func TestNewClientWithURL_AllowsHTTPS(t *testing.T) {
	client, err := NewClientWithURL("https://api.example.com", false)
	if err != nil {
		t.Fatalf("HTTPS should always be allowed: %v", err)
	}
	if client.baseURL != "https://api.example.com" {
		t.Errorf("expected base URL %q, got %q", "https://api.example.com", client.baseURL)
	}
}

func TestClient_DoesNotFollowRedirects(t *testing.T) {
	redirectTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"spoofed","date":"2026-01-01","encrypted_text":"SPOOFED","author":"Evil","difficulty":0,"hints":[]}`))
	}))
	defer redirectTarget.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, redirectTarget.URL+"/game/today", http.StatusFound)
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// FetchTodaysPuzzle should get the redirect response (302), not follow it
	_, err = client.FetchTodaysPuzzle()
	if err == nil {
		t.Fatal("expected error due to non-200 redirect response, got nil")
	}
}
