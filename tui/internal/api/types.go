package api

// Hint represents a single cipher-to-plain letter mapping hint
type Hint struct {
	CipherLetter string `json:"cipherLetter"`
	PlainLetter  string `json:"plainLetter"`
}

// Puzzle represents the puzzle response from the API
type Puzzle struct {
	ID            string `json:"id"`
	Date          string `json:"date"`
	EncryptedText string `json:"encryptedText"`
	Author        string `json:"author"`
	Category      string `json:"category"`
	Hints         []Hint `json:"hints"`
	Difficulty    int    `json:"difficulty"`
}

// CheckRequest represents the request body for checking a solution
type CheckRequest struct {
	Solution string `json:"solution"`
}

// CheckResponse represents the response from the check endpoint
type CheckResponse struct {
	Correct bool `json:"correct"`
}

// RegisterPlayerResponse represents the response from the register player endpoint
type RegisterPlayerResponse struct {
	ClaimCode string `json:"claimCode"`
}

// RecordSessionRequest represents the request body for recording a game session
type RecordSessionRequest struct {
	GameID         string `json:"gameId"`
	SolvedAt       string `json:"solvedAt"`       // RFC3339 timestamp when the puzzle was solved
	CompletionTime int64  `json:"completionTime"` // milliseconds
}

// RecordSessionResponse represents the response from the record session endpoint
type RecordSessionResponse struct {
	Status string `json:"status"` // "created" or "recorded"
}

// RecentSolve represents a single recent solve entry in player stats
type RecentSolve struct {
	Date           string  `json:"date"`           // YYYY-MM-DD
	CompletionTime float64 `json:"completionTime"` // milliseconds
}

// PlayerStatsResponse represents the response from the player stats endpoint
type PlayerStatsResponse struct {
	ClaimCode     string        `json:"claimCode"`
	BestTime      *float64      `json:"bestTime"`    // milliseconds, nullable
	AverageTime   *float64      `json:"averageTime"` // milliseconds, nullable
	RecentSolves  []RecentSolve `json:"recentSolves"`
	WinRate       float64       `json:"winRate"` // 0.0-1.0
	GamesPlayed   int           `json:"gamesPlayed"`
	GamesSolved   int           `json:"gamesSolved"`
	CurrentStreak int           `json:"currentStreak"`
	BestStreak    int           `json:"bestStreak"`
}
