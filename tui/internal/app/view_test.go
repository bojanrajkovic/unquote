package app

import (
	"testing"
	"time"
)

func TestFormatElapsed(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{
			name:     "zero duration",
			duration: 0,
			expected: "00:00",
		},
		{
			name:     "one second",
			duration: time.Second,
			expected: "00:01",
		},
		{
			name:     "one minute",
			duration: time.Minute,
			expected: "01:00",
		},
		{
			name:     "59 seconds",
			duration: 59 * time.Second,
			expected: "00:59",
		},
		{
			name:     "59 minutes 59 seconds",
			duration: 59*time.Minute + 59*time.Second,
			expected: "59:59",
		},
		{
			name:     "100 minutes",
			duration: 100 * time.Minute,
			expected: "100:00",
		},
		{
			name:     "90 seconds as 1:30",
			duration: 90 * time.Second,
			expected: "01:30",
		},
		{
			name:     "fractional seconds truncated",
			duration: 1*time.Second + 500*time.Millisecond,
			expected: "00:01",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatElapsed(tt.duration)
			if result != tt.expected {
				t.Errorf("formatElapsed(%v) = %q, expected %q", tt.duration, result, tt.expected)
			}
		})
	}
}
