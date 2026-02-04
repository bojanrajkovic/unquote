package puzzle

// DifficultyText converts a numeric difficulty score (0-100) to a text label
func DifficultyText(score int) string {
	switch {
	case score <= 25:
		return "Easy"
	case score <= 50:
		return "Medium"
	case score <= 75:
		return "Hard"
	default:
		return "Expert"
	}
}
