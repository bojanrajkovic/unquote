package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

// newClaimCodeCmd returns a command that displays the stored claim code.
func newClaimCodeCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "claim-code",
		Short: "Display your stored claim code",
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("loading config: %w", err)
			}

			if cfg == nil || cfg.ClaimCode == "" {
				fmt.Fprintln(cmd.OutOrStdout(), "No claim code found. Run 'unquote register' to get one.")
				return nil
			}

			fmt.Fprintln(cmd.OutOrStdout(), cfg.ClaimCode)
			return nil
		},
	}
}
