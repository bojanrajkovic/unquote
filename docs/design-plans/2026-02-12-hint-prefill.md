# Hint Prefill Design

## Summary

This design adds hint prefill to the Unquote TUI, where selected letters in each puzzle are automatically filled in with their decoded values to help players get started. Currently, hints are displayed as a text reference (e.g., "Clues: A=E, B=T") above the puzzle grid, but players must manually enter these letters into the corresponding cells. With hint prefill, the TUI will automatically populate these hint letters when the puzzle loads and lock them so they cannot be edited or cleared by the player.

The implementation replaces the `Cell` struct's boolean `IsLetter` field with a three-value enum (`CellKind`) that distinguishes between punctuation (not editable), regular letters (editable by player), and hint letters (prefilled and locked). Navigation functions skip hint cells the same way they currently skip punctuation, and input functions reject writes to hint cells. Hint cells render in cyan to visually connect them to the "Clues:" text above the grid. Session persistence requires no changes to the saved data format since hint values are deterministic from the puzzle data.

## Definition of Done

When a puzzle loads, all cells corresponding to hint letters are automatically filled with the correct plain letter. These hint cells are fully locked: the player can't type over them, backspace skips past them, arrow-key navigation skips them (like punctuation), and Ctrl+C (clear all) leaves them untouched. The "Clues" text line remains visible as a reference. Session persistence continues to work correctly (hint values are deterministic from the puzzle data and don't need to be saved).

## Glossary

- **Cell**: The data structure representing a single character position in the puzzle grid (can be a letter, punctuation, or space)
- **Cipher letter**: The encrypted letter shown to the player (e.g., "K" in a puzzle where K represents some other letter)
- **Plain letter**: The decoded/solution letter that the cipher letter represents (e.g., if K=S, then "S" is the plain letter)
- **BuildCells**: The function that constructs the grid of `Cell` objects from the encrypted puzzle text
- **AssembleSolution**: Function that collects all player inputs from the grid into a complete solution string for API validation
- **Session persistence**: Saving the player's in-progress inputs so they can be restored when the player returns to the puzzle

## Architecture

The TUI's `Cell` struct gains a `Kind` field replacing the current `IsLetter` boolean. `Kind` is an enum (`CellKind`) with three values: `CellPunctuation` (spaces, punctuation — not editable), `CellLetter` (regular letter — editable by player), and `CellHint` (hint letter — prefilled, locked). This eliminates the impossible state that two booleans (`IsLetter` + `IsHint`) would create.

`BuildCells` accepts hints alongside the encrypted text. After creating cells, it builds a cipher-to-plain map from the hint slice, then marks matching letter cells as `CellHint` with their `Input` pre-set to the plain letter.

All navigation functions (`NextLetterCell`, `PrevLetterCell`, `FirstLetterCell`, `LastLetterCell`, `NextUnfilledLetterCell`) change their `cell.IsLetter` check to `cell.Kind == CellLetter`. Hint cells are skipped identically to punctuation — this gives arrow keys, backspace, auto-advance, and mouse click the correct skip behavior with a single predicate change.

`SetInput` and `ClearInput` guard on `Kind == CellLetter`, rejecting writes to hint cells. `ClearAllInput` (Ctrl+C) only clears `CellLetter` cells, leaving hints untouched. `AssembleSolution` and `IsComplete` work without changes since hint cells have `Input` already set.

Hint cells render with a `HintCellStyle` using the existing cyan/aqua color (`ColorSecondary`), creating a visual link to the "Clues:" text line above the grid. When the cursor highlights related cells (same cipher letter), the related style takes precedence over the hint style since it's transient navigation feedback.

Session persistence skips `CellHint` cells when saving — hint values are deterministic from the puzzle response and reapplied on reload via `BuildCells`. On session restore, hints are applied first, then saved player inputs are applied on top (hint cells reject the input via the `SetInput` guard).

## Existing Patterns

The `Cell` struct already uses a boolean field (`IsLetter`) to distinguish editable from non-editable cells. All navigation and input functions check this field. This design replaces the boolean with a three-value enum — a natural extension of the existing pattern rather than a divergence.

Cell styling follows an established priority cascade in `renderInputCell`: active (cursor) > related (same cipher letter) > duplicate (conflict) > default. The new hint style slots into this cascade at the lowest priority, below duplicate detection.

The "Clues:" line rendering (`renderHints`) is unchanged — it continues to display hint mappings as text above the grid. The prefilled cells complement rather than replace this display.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Data Model — CellKind Enum

**Goal:** Replace `IsLetter bool` with `Kind CellKind` enum on the `Cell` struct and update `BuildCells` to accept hints.

**Components:**
- `CellKind` type and constants (`CellPunctuation`, `CellLetter`, `CellHint`) in `tui/internal/puzzle/cells.go`
- `Cell` struct updated: remove `IsLetter`, add `Kind CellKind`
- `BuildCells` signature changes to accept `[]api.Hint` (or a local hint type) and mark matching cells
- All existing tests in `tui/internal/puzzle/cells_test.go` updated for new struct
- New tests for hint cell creation via `BuildCells`

**Dependencies:** None (first phase)

**Done when:** `Cell` uses `Kind` enum, `BuildCells` correctly creates hint cells, all puzzle package tests pass.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Navigation and Input Functions

**Goal:** Navigation skips hint cells; input functions reject writes to hint cells.

**Components:**
- Navigation functions in `tui/internal/puzzle/cells.go` — change `cell.IsLetter` to `cell.Kind == CellLetter` in `NextLetterCell`, `PrevLetterCell`, `FirstLetterCell`, `LastLetterCell`, `NextUnfilledLetterCell`
- Input functions in `tui/internal/puzzle/solution.go` — `SetInput`, `ClearInput` guard on `Kind == CellLetter`; `ClearAllInput` skips `CellHint` cells
- `AssembleSolution` and `IsComplete` updated to use `Kind` field (logic unchanged since hint cells have `Input` set)
- Tests in `tui/internal/puzzle/cells_test.go` and `tui/internal/puzzle/solution_test.go` updated and extended for hint skip/reject behavior

**Dependencies:** Phase 1

**Done when:** Navigation skips hint cells, input rejects writes to hint cells, ClearAllInput preserves hints, all puzzle package tests pass.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: App Integration and Rendering

**Goal:** Wire hint data through the app model and render hint cells with distinct styling.

**Components:**
- `HintCellStyle` in `tui/internal/ui/styles.go` — cyan/aqua foreground (`ColorSecondary`), no bold
- `renderInputCell` in `tui/internal/app/grid.go` — add hint style to the priority cascade (below duplicate, above default)
- Puzzle loading in `tui/internal/app/update.go` — pass hints from API response to `BuildCells`
- Mouse click handler — `Kind == CellLetter` check replaces `IsLetter`
- Session save in `tui/internal/app/update.go` — skip `CellHint` cells when building the inputs map
- Session restore — apply hints first via `BuildCells`, then apply saved inputs (hint cells reject via guard)

**Dependencies:** Phase 2

**Done when:** Hint cells appear prefilled with cyan styling, cursor and keyboard skip them, Ctrl+C preserves them, session save/restore works correctly, `go build` succeeds, manual smoke test confirms behavior.
<!-- END_PHASE_3 -->

## Additional Considerations

**Hint type coupling:** `BuildCells` needs hint data but lives in the `puzzle` package, which currently doesn't import `api`. Define a local `Hint` struct in the puzzle package (or accept `map[rune]rune`) to avoid coupling puzzle to api types. The app layer converts `api.Hint` to whatever `BuildCells` expects.
