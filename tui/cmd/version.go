package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/bojanrajkovic/unquote/tui/internal/versioninfo"
)

// newVersionCmd returns a command that prints the build version information.
func newVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Run: func(cmd *cobra.Command, _ []string) {
			fmt.Fprintln(cmd.OutOrStdout(), versioninfo.Get())
		},
	}
}
