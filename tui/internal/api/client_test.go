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

func TestRegisterPlayer_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/player" {
			t.Errorf("expected path /player, got %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST method, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(RegisterPlayerResponse{ClaimCode: "ABCD-1234"})
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	result, err := client.RegisterPlayer()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.ClaimCode != "ABCD-1234" {
		t.Errorf("expected claim code %q, got %q", "ABCD-1234", result.ClaimCode)
	}
}

func TestRegisterPlayer_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("service unavailable"))
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	_, err = client.RegisterPlayer()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestRecordSession_Created(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/player/ABCD-1234/session" {
			t.Errorf("expected path /player/ABCD-1234/session, got %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST method, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		var req RecordSessionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if req.GameID != "test-game-id" {
			t.Errorf("expected game ID %q, got %q", "test-game-id", req.GameID)
		}
		if req.CompletionTime != 12345 {
			t.Errorf("expected completion time 12345, got %d", req.CompletionTime)
		}

		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	err = client.RecordSession("ABCD-1234", "test-game-id", 12345)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRecordSession_AlreadyRecorded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	err = client.RecordSession("ABCD-1234", "test-game-id", 12345)
	if err != nil {
		t.Fatalf("unexpected error on already recorded: %v", err)
	}
}

func TestRecordSession_PlayerNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte("player not found"))
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	err = client.RecordSession("INVALID", "test-game-id", 12345)
	if err == nil {
		t.Fatal("expected error for player not found, got nil")
	}
}

func TestRecordSession_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal server error"))
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	err = client.RecordSession("ABCD-1234", "test-game-id", 12345)
	if err == nil {
		t.Fatal("expected error on server error, got nil")
	}
}

func TestFetchStats_Success(t *testing.T) {
	bestTime := 45000.0
	avgTime := 60000.0
	expected := PlayerStatsResponse{
		ClaimCode:     "ABCD-1234",
		GamesPlayed:   10,
		GamesSolved:   8,
		WinRate:       0.8,
		CurrentStreak: 3,
		BestStreak:    5,
		BestTime:      &bestTime,
		AverageTime:   &avgTime,
		RecentSolves: []RecentSolve{
			{Date: "2026-02-15", CompletionTime: 45000.0},
			{Date: "2026-02-14", CompletionTime: 52000.0},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/player/ABCD-1234/stats" {
			t.Errorf("expected path /player/ABCD-1234/stats, got %s", r.URL.Path)
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
	result, err := client.FetchStats("ABCD-1234")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.ClaimCode != expected.ClaimCode {
		t.Errorf("expected claim code %q, got %q", expected.ClaimCode, result.ClaimCode)
	}
	if result.GamesPlayed != expected.GamesPlayed {
		t.Errorf("expected games played %d, got %d", expected.GamesPlayed, result.GamesPlayed)
	}
	if result.GamesSolved != expected.GamesSolved {
		t.Errorf("expected games solved %d, got %d", expected.GamesSolved, result.GamesSolved)
	}
	if result.WinRate != expected.WinRate {
		t.Errorf("expected win rate %f, got %f", expected.WinRate, result.WinRate)
	}
	if result.BestTime == nil || *result.BestTime != bestTime {
		t.Errorf("expected best time %f, got %v", bestTime, result.BestTime)
	}
	if result.AverageTime == nil || *result.AverageTime != avgTime {
		t.Errorf("expected average time %f, got %v", avgTime, result.AverageTime)
	}
	if len(result.RecentSolves) != 2 {
		t.Errorf("expected 2 recent solves, got %d", len(result.RecentSolves))
	}
}

func TestFetchStats_PlayerNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte("player not found"))
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	_, err = client.FetchStats("INVALID")
	if err == nil {
		t.Fatal("expected error for player not found, got nil")
	}
}

func TestFetchStats_NullableFields(t *testing.T) {
	// Stats response with null bestTime and averageTime (player has no solves)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"claimCode": "ABCD-1234",
			"gamesPlayed": 2,
			"gamesSolved": 0,
			"winRate": 0.0,
			"currentStreak": 0,
			"bestStreak": 0,
			"bestTime": null,
			"averageTime": null,
			"recentSolves": []
		}`))
	}))
	defer server.Close()

	client, err := NewClientWithURL(server.URL, true)
	if err != nil {
		t.Fatalf("unexpected error creating client: %v", err)
	}
	result, err := client.FetchStats("ABCD-1234")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.BestTime != nil {
		t.Errorf("expected nil BestTime, got %v", result.BestTime)
	}
	if result.AverageTime != nil {
		t.Errorf("expected nil AverageTime, got %v", result.AverageTime)
	}
	if len(result.RecentSolves) != 0 {
		t.Errorf("expected 0 recent solves, got %d", len(result.RecentSolves))
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
