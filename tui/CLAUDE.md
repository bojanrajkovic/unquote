# TUI

Last verified: 2026-02-03

Terminal UI client for playing cryptoquip puzzles.

## Tech Stack

- **Framework**: Bubble Tea (Elm architecture for Go)
- **Styling**: Lip Gloss
- **Language**: Go 1.25.6

## Commands

From `tui/` directory:
- `go build -o bin/unquote ./main.go` - Build binary
- `go test ./...` - Run all tests

## Package Structure

- `internal/api/` - API client for REST communication
- `internal/app/` - Bubble Tea model, update loop, and views
- `internal/puzzle/` - Domain logic (cells, navigation, solution assembly)
- `internal/ui/` - Styling and text wrapping utilities

## Contracts

### api package
- **Exposes**: `Client`, `NewClient()`, `NewClientWithURL(url)`
- **Guarantees**: Wraps all API errors with context
- **Expects**: API at `UNQUOTE_API_URL` env var (default: `http://localhost:3000`)

### puzzle package
- **Exposes**: `Cell`, `BuildCells()`, cell navigation functions, `AssembleSolution()`
- **Guarantees**: Navigation functions return -1 when no valid cell exists
- **Invariants**: `Cell.IsLetter` is true only for unicode letters; punctuation and spaces are non-editable

### app package
- **Exposes**: `Model`, `New()`, `NewWithClient(client)` for testing
- **States**: Loading -> Playing -> (Checking -> Playing | Solved) or Error
- **Invariants**: Terminal size validated before rendering; minimum 40x10

### ui package
- **Exposes**: Style definitions (colors, styles), text wrapping functions: `WordWrapText()`, `GroupCellsByWord()`, `WrapWordGroups()`, `FlattenLine()`
- **Guarantees**: Consistent color palette across all UI states; word-aware line breaking respects cell boundaries

## Key Decisions

- **Bubble Tea**: Elm architecture ensures predictable state management
- **Internal packages**: All packages under `internal/` prevent external imports
- **NewWithClient**: Enables testing without live API

## Anti-Patterns (Do NOT Add)

- Functional Core/Imperative Shell comments - the pattern is implicit, do not document in code

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UNQUOTE_API_URL` | No | http://localhost:3000 | API base URL |
