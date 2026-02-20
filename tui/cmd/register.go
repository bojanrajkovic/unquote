package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/config"
)

// newRegisterCmd returns a command that registers a new player for stats tracking.
// insecure is closed over from NewRootCmd's scope.
func newRegisterCmd(insecure *bool) *cobra.Command {
	return &cobra.Command{
		Use:   "register",
		Short: "Register for stats tracking and get a claim code",
		RunE: func(cmd *cobra.Command, _ []string) error {
			existing, err := config.Load()
			if err != nil {
				return fmt.Errorf("loading config: %w", err)
			}

			if existing != nil && existing.ClaimCode != "" {
				fmt.Fprintf(cmd.OutOrStdout(), "Already registered with claim code: %s\n", existing.ClaimCode)
				return nil
			}

			client, err := api.NewClient(*insecure)
			if err != nil {
				return fmt.Errorf("creating API client: %w", err)
			}

			resp, err := client.RegisterPlayer()
			if err != nil {
				return fmt.Errorf("registering player: %w", err)
			}

			cfg := &config.Config{
				ClaimCode:    resp.ClaimCode,
				StatsEnabled: true,
			}
			if err := config.Save(cfg); err != nil {
				return fmt.Errorf("saving config: %w", err)
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Registered! Your claim code is: %s\n", resp.ClaimCode)
			fmt.Fprintln(cmd.OutOrStdout(), "Save this code to access your stats from another device.")
			return nil
		},
	}
}
