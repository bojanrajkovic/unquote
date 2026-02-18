// Package cmd provides the CLI commands for the unquote TUI.
package cmd

import (
	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
	"github.com/spf13/cobra"

	"github.com/bojanrajkovic/unquote/tui/internal/app"
)

// NewRootCmd returns a fresh root command for the unquote CLI.
// A constructor is used instead of package-level vars to avoid state
// accumulation between test runs.
func NewRootCmd() *cobra.Command {
	var insecure bool
	var random bool

	rootCmd := &cobra.Command{
		Use:          "unquote",
		Short:        "Play cryptoquip puzzles in your terminal",
		SilenceUsage: true,
		RunE: func(_ *cobra.Command, _ []string) error {
			zone.NewGlobal()

			opts := app.Options{
				Insecure: insecure,
				Random:   random,
			}

			model, err := app.New(opts)
			if err != nil {
				return err
			}

			p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())
			_, err = p.Run()
			return err
		},
	}

	rootCmd.PersistentFlags().BoolVar(&insecure, "insecure", false, "allow insecure HTTP connections to non-localhost hosts")
	rootCmd.PersistentFlags().BoolVar(&random, "random", false, "play a random puzzle instead of today's")

	rootCmd.AddCommand(newVersionCmd())

	return rootCmd
}

// Execute creates a root command and runs it, returning any error.
func Execute() error {
	return NewRootCmd().Execute()
}
