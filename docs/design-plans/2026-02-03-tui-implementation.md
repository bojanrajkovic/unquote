# TUI Implementation Design

## Summary

This design implements a terminal-based user interface for the Unquote cryptoquip game using the Bubble Tea framework's Model-View-Update (MVU) architecture. The TUI will fetch daily puzzles from the API, render them in a readable grid layout with cipher letters displayed below input cells, and allow users to solve puzzles through keyboard input with real-time navigation and validation.

The implementation follows a state machine pattern with four primary states (Loading → Playing → Checking → Solved) plus error handling. Users interact with the puzzle through letter input that auto-advances, arrow key navigation, and submission via Enter. The application validates puzzle completion before submission, checks solutions against the API, and displays success/failure states while maintaining visual clarity through Lip Gloss styling and word-wrapped layout constrained to 60-70 character width.

## Definition of Done

- TUI launches and fetches today's puzzle from the API
- Puzzle displays with header, difficulty (as text), hints, cipher grid, and author
- User can type letters into cells with auto-advance and backspace navigation
- Arrow keys allow free navigation between letter cells
- Enter submits solution (only when complete), Ctrl+C clears, Esc quits
- Success state displays congratulations and keeps puzzle visible
- Error states show appropriate messages with retry option
- API URL configurable via `UNQUOTE_API_URL` environment variable

## Glossary

- **Bubble Tea**: A Go framework for building terminal user interfaces based on The Elm Architecture, providing message-driven state management
- **MVU (Model-View-Update)**: Architectural pattern where the Model holds state, View renders it, and Update processes messages to produce new state
- **Lip Gloss**: Styling library for terminal UIs that provides layout and color management (companion to Bubble Tea)
- **State Machine**: Control flow pattern where the application transitions between discrete states (Loading, Playing, Checking, Solved, Error)
- **Cell**: A single character position in the puzzle containing the encrypted cipher character and optional user input
- **Cipher**: The encrypted letter displayed below each input cell that the user must decode
- **Auto-advance**: UX pattern where the cursor automatically moves to the next editable cell after typing a letter
- **Word Wrapping**: Breaking puzzle text across multiple lines at word boundaries to fit terminal width constraints
- **Inverse Colors**: Visual highlighting technique that swaps foreground and background colors to indicate the active cell

## Architecture

Single-model MVU (Model-View-Update) architecture using Bubble Tea framework with a state machine for application flow.

**Application States:**
```
Loading → Playing → Checking → Solved
    ↓         ↓         ↓
  Error    Error     Error
```

**Core Model Structure:**
- `state` - Current application state enum
- `puzzle` - API response data (encrypted text, hints, author, difficulty, gameId)
- `cells` - Array of input cells tracking position, cipher character, and user input
- `cursorPos` - Index of currently focused editable cell
- `errorMsg` - Error message when in error state
- `apiBaseURL` - Configured API endpoint from environment

**Message Types:**
- `puzzleFetchedMsg` - Puzzle loaded successfully from API
- `solutionCheckedMsg` - API returned validation result (correct/incorrect)
- `errMsg` - Network or API error occurred

**Configuration:**
- `UNQUOTE_API_URL` environment variable (default: `http://localhost:3000`)

## Visual Layout

Terminal layout constrained to ~60-70 character width for readability:

```
┌─────────────────────────────────────────────────────────┐
│                     CRYPTO-QUIP                          │  Header (centered, bold)
│                   Difficulty: Medium                     │  Difficulty as text
├─────────────────────────────────────────────────────────┤
│  Clues: Y = B, C = F                                    │  Hints row
├─────────────────────────────────────────────────────────┤
│                                                          │
│   _  _  _  _  _     _  _     _  _  _  _  _              │  User input cells
│   T  H  I  N  K     O  F     W  H  A  T  S              │  Encrypted letters
│                                                          │
│   _  _  _  _  _  _  _  _  _  .                          │
│   I  M  P  O  R  T  A  N  T  .                          │
│                                                          │
│                  — Author Name                           │  Author (always shown)
├─────────────────────────────────────────────────────────┤
│  [Enter] Submit   [Esc] Quit   [Ctrl+C] Clear           │  Help bar
└─────────────────────────────────────────────────────────┘
```

**Cell Rendering:**
- Each letter position has input cell (underline) above cipher letter below
- Current cell highlighted with inverse colors
- Spaces render as visual gaps between words
- Punctuation shown inline but non-editable (auto-skipped during input)

**Word Wrapping:**
- Max line width ~50-60 characters of puzzle content
- Wrap at word boundaries only
- Each line contains row of input cells + cipher letters

**Difficulty Mapping:**
- 0-25: "Easy"
- 26-50: "Medium"
- 51-75: "Hard"
- 76-100: "Expert"

## Existing Patterns

Investigation found the TUI directory is completely stubbed:
- `main.go` contains only "Hello, world!" placeholder
- `go.mod` declares module name and Go 1.25.6, no dependencies
- No existing package structure or patterns

This design introduces new patterns for the TUI:
- MVU architecture following Bubble Tea conventions
- `internal/` package structure for encapsulation
- Separation of concerns: `app/` (model/update/view), `api/` (HTTP client), `puzzle/` (domain logic), `ui/` (styles)

These patterns align with Bubble Tea community best practices and Go project layout conventions.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Project Setup and Dependencies

**Goal:** Initialize project structure with Bubble Tea dependencies and basic app skeleton

**Components:**
- `go.mod` — Add Bubble Tea and Lip Gloss dependencies (latest versions)
- `main.go` — Entry point that creates and runs tea.Program
- `internal/app/model.go` — Basic model struct with state enum, Init/Update/View stubs
- `internal/ui/styles.go` — Lip Gloss style definitions for all visual elements

**Dependencies:** None (first phase)

**Done when:** `go build` succeeds, running binary shows placeholder UI with styled header
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: API Client

**Goal:** HTTP client for fetching puzzles and checking solutions

**Components:**
- `internal/api/types.go` — Request/response structs matching API schema (Puzzle, Hint, CheckRequest, CheckResponse)
- `internal/api/client.go` — Client struct with FetchTodaysPuzzle() and CheckSolution() methods
- Environment variable reading for `UNQUOTE_API_URL` with localhost default

**Dependencies:** Phase 1 (project structure)

**Done when:** Client can fetch puzzle from running API server, unit tests pass with mock HTTP responses
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Puzzle Domain Logic

**Goal:** Cell representation and puzzle state management

**Components:**
- `internal/puzzle/cells.go` — Cell struct (index, char, input, isLetter), BuildCells() from encrypted text, navigation helpers (NextLetterCell, PrevLetterCell)
- `internal/puzzle/difficulty.go` — DifficultyText() mapping score to Easy/Medium/Hard/Expert
- `internal/puzzle/solution.go` — AssembleSolution() combining user input with original punctuation/spaces, IsComplete() validation

**Dependencies:** Phase 2 (API types for puzzle data)

**Done when:** Unit tests pass for cell building, navigation, solution assembly, difficulty mapping
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Loading State and Puzzle Fetch

**Goal:** App starts in loading state, fetches puzzle, transitions to playing

**Components:**
- `internal/app/messages.go` — Custom message types (puzzleFetchedMsg, errMsg)
- `internal/app/model.go` — Add puzzle field, loading/error states
- `internal/app/update.go` — Handle Init() to fire fetch command, process puzzleFetchedMsg to build cells and transition to playing state
- `internal/app/view.go` — Render loading spinner, error message with retry option

**Dependencies:** Phase 2 (API client), Phase 3 (cell building)

**Done when:** App fetches puzzle on startup, displays loading state, shows error with retry on failure
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Puzzle Rendering

**Goal:** Display puzzle grid with header, hints, cipher letters, input cells, author

**Components:**
- `internal/app/view.go` — Full puzzle rendering with word wrapping, styled header, hints formatting, cell grid (input above cipher), author display, help bar
- `internal/ui/styles.go` — Finalize all styles (header, hints, active cell, filled cell, cipher letter, author, help)

**Dependencies:** Phase 4 (puzzle data available in model)

**Done when:** Puzzle displays correctly with proper layout, word wrapping, and styling
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: Input Handling and Navigation

**Goal:** User can type letters, navigate with arrows and backspace

**Components:**
- `internal/app/update.go` — Key handling for A-Z (set cell, auto-advance), Backspace (clear, move back), Left/Right arrows (navigate letter cells), Ctrl+C (clear all), Esc (quit)
- `internal/app/view.go` — Highlight current cell with inverse colors

**Dependencies:** Phase 5 (puzzle rendered), Phase 3 (navigation helpers)

**Done when:** User can fill in puzzle, navigate freely, clear input, quit application
<!-- END_PHASE_6 -->

<!-- START_PHASE_7 -->
### Phase 7: Solution Submission

**Goal:** Submit solution to API, handle success/failure states

**Components:**
- `internal/app/messages.go` — Add solutionCheckedMsg
- `internal/app/update.go` — Enter key triggers submission (only if complete), fire API check command, handle response (correct → solved state, incorrect → show message and stay in playing)
- `internal/app/view.go` — Render checking state, solved state with success message, incomplete warning

**Dependencies:** Phase 6 (input complete), Phase 2 (API client CheckSolution)

**Done when:** Solution submission works, success shows congratulations, failure shows "keep trying", incomplete input blocked
<!-- END_PHASE_7 -->

<!-- START_PHASE_8 -->
### Phase 8: Error Handling and Polish

**Goal:** Robust error handling, terminal size validation, final polish

**Components:**
- `internal/app/update.go` — Network error handling with retry ('r' key), timeout handling (5s default)
- `internal/app/view.go` — Terminal size check (min 40x10), "terminal too small" message
- `main.go` — Graceful shutdown, error exit codes

**Dependencies:** All previous phases

**Done when:** Errors display with retry option, small terminal handled gracefully, app exits cleanly
<!-- END_PHASE_8 -->

## Additional Considerations

**Error Messages:**
- Connection refused: "Cannot connect to server. Check that the API is running."
- Timeout: "Request timed out. Press 'r' to retry."
- Non-2xx response: "Server error: {status}. Press 'r' to retry."

**Input Validation:**
- Only A-Z accepted (lowercase auto-converted to uppercase)
- Non-letter keypresses ignored when on letter cell
- Enter blocked with "Fill in all letters first" if puzzle incomplete
