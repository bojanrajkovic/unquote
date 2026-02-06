package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"

	"github.com/bojanrajkovic/unquote/tui/internal/app"
	"github.com/bojanrajkovic/unquote/tui/internal/version"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "version" {
		fmt.Println(version.Get())
		return
	}

	zone.NewGlobal()

	p := tea.NewProgram(app.New(), tea.WithAltScreen(), tea.WithMouseCellMotion())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error running program: %v\n", err)
		os.Exit(1)
	}
}
