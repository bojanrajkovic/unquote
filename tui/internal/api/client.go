package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

const (
	defaultBaseURL   = "https://unquote.gaur-kardashev.ts.net"
	defaultTimeout   = 5 * time.Second
	envAPIURL        = "UNQUOTE_API_URL"
	maxResponseBytes = 128 * 1024 // 128KB
)

// Client handles communication with the Unquote API
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new API client with configuration from environment
func NewClient() *Client {
	baseURL := os.Getenv(envAPIURL)
	if baseURL == "" {
		baseURL = defaultBaseURL
	}

	warnIfInsecureURL(baseURL)

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

// NewClientWithURL creates a new API client with a custom base URL
func NewClientWithURL(baseURL string) *Client {
	warnIfInsecureURL(baseURL)

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

// warnIfInsecureURL prints a warning to stderr if the URL uses HTTP
// with a non-localhost host.
func warnIfInsecureURL(rawURL string) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return
	}
	if u.Scheme != "http" {
		return
	}
	host := u.Hostname()
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return
	}
	fmt.Fprintf(os.Stderr, "WARNING: API URL %q uses insecure HTTP for non-localhost host. Consider using HTTPS.\n", rawURL)
}

// FetchTodaysPuzzle retrieves the puzzle for today
func (c *Client) FetchTodaysPuzzle() (*Puzzle, error) {
	url := fmt.Sprintf("%s/game/today", c.baseURL)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch puzzle: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
	}

	var puzzle Puzzle
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&puzzle); err != nil {
		return nil, fmt.Errorf("failed to parse puzzle response: %w", err)
	}

	return &puzzle, nil
}

// FetchPuzzleByDate retrieves the puzzle for a specific date
func (c *Client) FetchPuzzleByDate(date string) (*Puzzle, error) {
	url := fmt.Sprintf("%s/game/%s", c.baseURL, date)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch puzzle: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
	}

	var puzzle Puzzle
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&puzzle); err != nil {
		return nil, fmt.Errorf("failed to parse puzzle response: %w", err)
	}

	return &puzzle, nil
}

// CheckSolution validates the user's solution against the API
func (c *Client) CheckSolution(gameID, solution string) (*CheckResponse, error) {
	url := fmt.Sprintf("%s/game/%s/check", c.baseURL, gameID)

	reqBody := CheckRequest{Solution: solution}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to check solution: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("game not found: invalid game ID")
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
	}

	var result CheckResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse check response: %w", err)
	}

	return &result, nil
}
