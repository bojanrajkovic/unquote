# TUI Mouse Support Design

## Summary

This feature adds mouse support to the TUI, allowing players to click on letter cells to move the cursor instead of relying solely on keyboard navigation. The implementation uses BubbleZone, a coordinate mapping library for Bubble Tea applications, which eliminates the need for manual position tracking across word-wrapped lines.

The approach wraps each rendered letter cell with an invisible zone marker during the render phase. When a mouse click occurs, the update loop checks which zone contains the click coordinates and moves the cursor to the corresponding cell index. Non-letter cells (spaces, punctuation) are not wrapped in zones, so clicks on them have no effect. This design preserves all existing keyboard navigation while adding an intuitive point-and-click interaction model.

## Definition of Done
- Click any letter cell (input or cipher row) to move cursor there
- Non-letter cells ignore clicks
- Keyboard navigation continues to work unchanged
- Works across word-wrapped lines

## Glossary

- **Bubble Tea**: An Elm-inspired TUI framework for Go that follows The Elm Architecture (Model-View-Update pattern)
- **BubbleZone**: A coordinate mapping library for Bubble Tea that tracks screen positions of UI elements without manual calculation
- **Lip Gloss**: A styling library for terminal UIs, used for cell colors and borders
- **Zone marker**: An invisible tracking annotation added to rendered content that associates screen coordinates with application data
- **Cell Index**: The position of a character in the original encrypted puzzle text (0-based)
- **Cipher row**: The row displaying the encrypted letters from the puzzle
- **Input row**: The row where players enter their letter substitutions
- **tea.MouseMsg**: A Bubble Tea event message containing mouse button state and screen coordinates
- **tea.WithMouseCellMotion()**: A Bubble Tea program option that enables mouse event reporting from the terminal
- **zone.Scan()**: BubbleZone function that processes rendered output to extract and register zone boundaries
- **zone.Mark()**: BubbleZone function that wraps content with invisible zone tracking annotations
- **InBounds()**: BubbleZone method that tests whether mouse coordinates fall within a zone's boundaries

## Architecture

Click-to-navigate capability using BubbleZone for coordinate mapping. BubbleZone wraps rendered elements with zone markers, enabling screen coordinate to cell index mapping without manual position tracking.

**Key components:**

1. **Zone manager initialization** (`tui/main.go`): Initialize BubbleZone global manager at program start alongside existing `tea.NewProgram` call.

2. **Mouse event enabling** (`tui/main.go`): Add `tea.WithMouseCellMotion()` to program options.

3. **Zone marking** (`tui/internal/app/grid.go`): Wrap each letter cell's rendered output with `zone.Mark(cellID, content)` in `renderInputCell` and `renderCipherCell`. Use cell Index as zone ID (e.g., `zone.Mark(fmt.Sprintf("cell-%d", cell.Index), content)`).

4. **Zone scanning** (`tui/internal/app/view.go`): Wrap final grid output in `zone.Scan()` at root View() level.

5. **Click handling** (`tui/internal/app/update.go`): Handle `tea.MouseMsg` by iterating registered zone IDs and checking `zone.Get(cellID).InBounds(msg)`. On match, update `m.cursorPos` to that cell's Index.

**Data flow:**
```
MouseMsg received → Check left button release →
Iterate cell zone IDs → Find zone where InBounds(msg) == true →
Verify cell.IsLetter == true → Update m.cursorPos
```

**Non-letter cell handling:** Zone marking skips non-letter cells entirely. Clicks on spaces/punctuation find no matching zone, so cursor stays unchanged.

## Existing Patterns

Investigation found existing rendering in `tui/internal/app/grid.go` uses Lip Gloss for cell styling and joining. This design follows the same pattern:
- Individual cells rendered through `renderInputCell`/`renderCipherCell`
- Styles defined in `tui/internal/ui/styles.go`
- Model state updated in `tui/internal/app/update.go`

No existing mouse handling patterns. BubbleZone is a new dependency but follows Charm ecosystem conventions (same maintainers as Bubble Tea and Lip Gloss).

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Add BubbleZone Dependency
**Goal:** Add BubbleZone library and initialize zone manager

**Components:**
- `go.mod` — add `github.com/lrstanley/bubblezone` dependency
- `tui/main.go` — initialize `zone.NewGlobal()` at program start
- `tui/main.go` — add `tea.WithMouseCellMotion()` to program options

**Dependencies:** None

**Done when:** Program compiles with BubbleZone imported, mouse events enabled
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Zone Marking in Grid Rendering
**Goal:** Wrap letter cells with zone markers during render

**Components:**
- `tui/internal/app/grid.go` — modify `renderInputCell` to wrap output with `zone.Mark()`
- `tui/internal/app/grid.go` — modify `renderCipherCell` to wrap output with `zone.Mark()`
- `tui/internal/app/view.go` — wrap grid output in `zone.Scan()` at View() root

**Dependencies:** Phase 1 (BubbleZone available)

**Done when:** Zones registered for all letter cells, visible in debug output if enabled
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Click Event Handling
**Goal:** Handle mouse clicks to navigate cursor

**Components:**
- `tui/internal/app/update.go` — add `tea.MouseMsg` case in Update()
- `tui/internal/app/update.go` — implement zone bounds checking logic
- `tui/internal/app/update.go` — update `m.cursorPos` on valid cell click

**Dependencies:** Phase 2 (zones registered)

**Done when:** Clicking a letter cell moves cursor to that cell, clicking non-letters does nothing, keyboard navigation still works
<!-- END_PHASE_3 -->

## Additional Considerations

**Terminal compatibility:** BubbleZone relies on Bubble Tea's mouse coordinate reporting. Some older terminals may have coordinate limits (e.g., column 95 on old Windows Terminal). This is a known terminal limitation, not a BubbleZone issue.

**Zone ID uniqueness:** Using cell Index guarantees uniqueness since Index is the position in the original encrypted text. No collision handling needed.
