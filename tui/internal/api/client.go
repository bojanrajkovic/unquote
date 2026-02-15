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
func NewClient(insecure bool) (*Client, error) {
	baseURL := os.Getenv(envAPIURL)
	if baseURL == "" {
		baseURL = defaultBaseURL
	}

	if err := validateURL(baseURL, insecure); err != nil {
		return nil, err
	}

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}, nil
}

// NewClientWithURL creates a new API client with a custom base URL
func NewClientWithURL(baseURL string, insecure bool) (*Client, error) {
	if err := validateURL(baseURL, insecure); err != nil {
		return nil, err
	}

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}, nil
}

// validateURL checks that the URL is secure unless insecure is true.
// Returns an error if insecure is false and the URL uses HTTP with a non-localhost host.
func validateURL(rawURL string, insecure bool) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "http" {
		return nil
	}
	if insecure {
		return nil
	}
	host := u.Hostname()
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return nil
	}
	return fmt.Errorf("insecure HTTP connection to %q is not allowed (use --insecure to override)", host)
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

// FetchRandomPuzzle retrieves a random puzzle
func (c *Client) FetchRandomPuzzle() (*Puzzle, error) {
	url := fmt.Sprintf("%s/game/random", c.baseURL)

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
