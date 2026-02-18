package cmd

import (
	"errors"
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
	"github.com/spf13/cobra"

	"github.com/bojanrajkovic/unquote/tui/internal/app"
	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

// newStatsCmd returns a command that launches the stats screen.
func newStatsCmd(insecure *bool) *cobra.Command {
	return &cobra.Command{
		Use:   "stats",
		Short: "View your player statistics",
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("loading config: %w", err)
			}

			if cfg == nil || cfg.ClaimCode == "" {
				fmt.Fprintln(cmd.ErrOrStderr(), "No claim code found. Run 'unquote register' first.")
				return errors.New("no claim code")
			}

			zone.NewGlobal()

			opts := app.Options{
				Insecure:  *insecure,
				StatsMode: true,
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
}
