package app

import (
	"errors"
	"testing"
)

func TestFormatErrorMessage(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected string
	}{
		{
			name:     "connection refused",
			err:      errors.New("connection refused"),
			expected: "Cannot connect to server. Check that the API is running.",
		},
		{
			name:     "timeout error",
			err:      errors.New("i/o timeout"),
			expected: "Request timed out. Press 'r' to retry.",
		},
		{
			name:     "deadline exceeded",
			err:      errors.New("context deadline exceeded"),
			expected: "Request timed out. Press 'r' to retry.",
		},
		{
			name:     "server error response",
			err:      errors.New("server returned 500 Internal Server Error"),
			expected: "server returned 500 Internal Server Error Press 'r' to retry.",
		},
		{
			name:     "generic error",
			err:      errors.New("something went wrong"),
			expected: "something went wrong",
		},
		{
			name:     "empty error",
			err:      errors.New(""),
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatErrorMessage(tt.err)
			if result != tt.expected {
				t.Errorf("formatErrorMessage() = %q, want %q", result, tt.expected)
			}
		})
	}
}
