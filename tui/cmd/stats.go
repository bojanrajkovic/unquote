package cmd

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/guptarohit/asciigraph"
	"github.com/spf13/cobra"

	"github.com/bojanrajkovic/unquote/tui/internal/api"
	"github.com/bojanrajkovic/unquote/tui/internal/config"
	"github.com/bojanrajkovic/unquote/tui/internal/ui"
)

// formatMs formats milliseconds as M:SS (e.g. 128000 → "2:08").
func formatMs(ms float64) string {
	minutes := int(ms) / 60000
	seconds := (int(ms) % 60000) / 1000
	return fmt.Sprintf("%d:%02d", minutes, seconds)
}

func formatOptMs(ms *float64) string {
	if ms == nil {
		return "—"
	}
	return formatMs(*ms)
}

// newStatsCmd returns a command that fetches and prints player stats to stdout.
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

			client, err := api.NewClient(*insecure)
			if err != nil {
				return fmt.Errorf("creating API client: %w", err)
			}

			stats, err := client.FetchStats(cfg.ClaimCode)
			if err != nil {
				return fmt.Errorf("fetching stats: %w", err)
			}

			out := cmd.OutOrStdout()
			fmt.Fprintln(out, renderStatsOutput(stats))
			return nil
		},
	}
}

func renderStatsOutput(stats *api.PlayerStatsResponse) string {
	labelStyle := lipgloss.NewStyle().Foreground(ui.ColorMuted)
	valueStyle := lipgloss.NewStyle().Foreground(ui.ColorPrimary).Bold(true)
	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(ui.ColorWhite)

	var b strings.Builder

	b.WriteString(headerStyle.Render("CRYPTO-QUIP STATS"))
	b.WriteString("\n\n")

	// Summary table
	rows := []struct{ label, value string }{
		{"Games Played", fmt.Sprintf("%d", stats.GamesPlayed)},
		{"Games Solved", fmt.Sprintf("%d", stats.GamesSolved)},
		{"Win Rate", fmt.Sprintf("%.1f%%", stats.WinRate*100)},
		{"Current Streak", fmt.Sprintf("%d", stats.CurrentStreak)},
		{"Best Streak", fmt.Sprintf("%d", stats.BestStreak)},
		{"Best Time", formatOptMs(stats.BestTime)},
		{"Avg Time", formatOptMs(stats.AverageTime)},
	}

	for _, r := range rows {
		b.WriteString(fmt.Sprintf("  %s  %s\n",
			labelStyle.Width(16).Render(r.label),
			valueStyle.Render(r.value),
		))
	}

	// Solve-time graph (last 30 days)
	const dayWindow = 30
	n := len(stats.RecentSolves)
	if n > 0 {
		if n > dayWindow {
			n = dayWindow
		}

		points := make([]float64, dayWindow)
		for i := range dayWindow {
			points[i] = math.NaN()
		}

		offset := dayWindow - n
		for i := range n {
			points[offset+i] = stats.RecentSolves[len(stats.RecentSolves)-n+i].CompletionTime / 60000.0
		}

		plot := asciigraph.Plot(points,
			asciigraph.Height(8),
			asciigraph.Width(50),
			asciigraph.Precision(1),
			asciigraph.LowerBound(0),
			asciigraph.Caption("Solve Times (last 30 days, minutes)"),
		)

		b.WriteString("\n")
		b.WriteString(plot)
		b.WriteString("\n")
	}

	return b.String()
}
