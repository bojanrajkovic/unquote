package main

import (
	"flag"
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"

	"github.com/bojanrajkovic/unquote/tui/internal/app"
	"github.com/bojanrajkovic/unquote/tui/internal/version"
)

func main() {
	// Check for version subcommand before flag parsing
	if len(os.Args) > 1 && os.Args[1] == "version" {
		fmt.Println(version.Get())
		return
	}

	// Define flags
	insecure := flag.Bool("insecure", false, "allow insecure HTTP connections to non-localhost hosts")
	random := flag.Bool("random", false, "play a random puzzle instead of today's")
	showVersion := flag.Bool("version", false, "print version information and exit")
	flag.Parse()

	// Handle --version flag
	if *showVersion {
		fmt.Println(version.Get())
		return
	}

	zone.NewGlobal()

	// Create options and pass to app.New()
	opts := app.Options{
		Insecure: *insecure,
		Random:   *random,
	}
	model, err := app.New(opts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error running program: %v\n", err)
		os.Exit(1)
	}
}
