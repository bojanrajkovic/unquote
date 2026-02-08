package app

import (
	"testing"
)

func TestNewWithOptions(t *testing.T) {
	tests := []struct {
		name string
		opts Options
	}{
		{
			name: "create model with insecure false",
			opts: Options{
				Insecure: false,
			},
		},
		{
			name: "create model with insecure true",
			opts: Options{
				Insecure: true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model := New(tt.opts)
			if model.state != StateLoading {
				t.Errorf("New() state = %v, want %v", model.state, StateLoading)
			}
			if model.client == nil {
				t.Errorf("New() client = nil, want non-nil")
			}
			if model.opts != tt.opts {
				t.Errorf("New() opts = %v, want %v", model.opts, tt.opts)
			}
		})
	}
}
