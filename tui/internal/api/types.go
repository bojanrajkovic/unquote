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
	Difficulty    int    `json:"difficulty"`
	Hints         []Hint `json:"hints"`
}

// CheckRequest represents the request body for checking a solution
type CheckRequest struct {
	Solution string `json:"solution"`
}

// CheckResponse represents the response from the check endpoint
type CheckResponse struct {
	Correct bool `json:"correct"`
}
