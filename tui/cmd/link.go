package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

// newLinkCmd returns a command that links an existing claim code to the local config.
// The claim code is not validated against the server; the server will return 404
// on subsequent API calls if the code is invalid.
func newLinkCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "link <claim-code>",
		Short: "Link an existing claim code to this device",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			claimCode := args[0]

			cfg := &config.Config{
				ClaimCode:    claimCode,
				StatsEnabled: true,
			}
			if err := config.Save(cfg); err != nil {
				return fmt.Errorf("saving config: %w", err)
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Linked claim code: %s\n", claimCode)
			return nil
		},
	}
}
