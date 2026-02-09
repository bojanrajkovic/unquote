# Duplicate Plaintext Letter Warning Design

## Summary

This feature adds visual feedback when players make conflicting letter assignments in the cryptoquip puzzle. When a player assigns the same plaintext letter (e.g., "A") to two or more different ciphertext letters (e.g., both "X" and "Y"), the affected input cells are highlighted with an orange/yellow warning background to indicate the conflict. This warning is purely informational and does not block the player from making or submitting the assignment.

The implementation follows the existing pattern used for related-cell highlighting: a pure function scans the puzzle cells at render time to identify duplicates, and the result is threaded through the rendering chain to apply a new `DuplicateInputStyle` to affected cells. The warning style slots into the existing style precedence hierarchy between the active cursor style (highest priority) and the related-cell style, ensuring conflicts are visually prominent while still allowing the cursor to stand out.

## Definition of Done

When a player assigns the same plaintext letter to two or more different ciphertext letters, all affected input cells are highlighted with a warning color (yellow/orange). This warning supersedes the existing "related cell" highlighting (dark gray background) but not the active cursor style. The warning is purely visual — it does not prevent the player from making the assignment.

## Glossary

- **Ciphertext letter**: The encrypted letter as it appears in the original puzzle (e.g., "X" in "XEBBQ").
- **Plaintext letter**: The decrypted letter the player believes corresponds to a ciphertext letter (e.g., "H" substituted for "X").
- **Input cell**: The top row of each letter cell in the TUI grid, where players type their plaintext substitutions.
- **Cipher cell**: The bottom row of each letter cell in the TUI grid, showing the original encrypted letter.
- **Related cell**: A cell containing the same ciphertext letter as the currently focused cell, highlighted for navigational context.
- **Render time**: The moment when the TUI redraws the grid in response to user input or timer ticks, as opposed to when user actions modify the model state.
- **Style precedence**: The ordering rules that determine which visual style applies when multiple conditions are true (e.g., a cell is both at the cursor position and contains a duplicate input).
- **Bubble Tea**: The Go framework used by the TUI, following the Elm architecture pattern (model/update/view).
- **Lip Gloss**: A Go styling library used for terminal UI formatting, including colors and layouts.

## Architecture

Duplicate detection is computed at render time as a pure function of the current cells slice, following the same pattern used for related-cell highlighting (`highlightChar` derivation in `renderGrid()`). No model state changes are needed.

**Detection:** A new `findDuplicateInputs(cells []puzzle.Cell) map[rune]bool` function scans cells once, building a `map[rune][]rune` of plaintext input → set of cipher letters. Any plaintext letter mapped by 2+ distinct cipher letters is added to the result set. This function is called once per render in `renderGrid()` and the result is threaded through `renderLine()` to `renderInputCell()`.

**Rendering:** A new `DuplicateInputStyle` (orange background, dark foreground) slots into the existing style precedence chain:

1. `ActiveCellStyle` — cursor position (highest priority, unchanged)
2. `DuplicateInputStyle` — cell's input is in the duplicate set (NEW)
3. `RelatedCellStyle` — same cipher letter as cursor (unchanged)
4. `CellStyle` — default (unchanged)

The warning supersedes related-cell highlighting because it represents an error-like condition the player needs to notice, whereas related highlighting is navigational context.

**Scope:** Warning applies only to input cells (top row), consistent with existing `RelatedCellStyle` behavior. Cipher cells (bottom row) are unaffected. The warning is purely visual — it does not block input or prevent submission.

## Existing Patterns

Investigation found the related-cell highlighting feature (`RelatedCellStyle`) follows the same render-time derivation pattern:

- `renderGrid()` computes `highlightChar` from cursor position (a single index lookup)
- `highlightChar` is passed through `renderLine()` → `renderInputCell()`
- `renderInputCell()` checks precedence: active > related > default

This design follows the identical pattern — compute derived state in `renderGrid()`, thread it down, check in precedence order. The only difference is `findDuplicateInputs` requires a full scan (O(n)) rather than an O(1) lookup, but n is typically 100-300 characters and runs at most once per keypress or timer tick (1 Hz).

Style definitions follow the existing pattern in `ui/styles.go`: named color constant + style variable composed from `CellStyle`.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Warning Style Definition

**Goal:** Add the warning color and duplicate input style to the styling system.

**Components:**
- `ColorWarning` constant in `tui/internal/ui/styles.go` — ANSI color 214 (orange)
- `DuplicateInputStyle` in `tui/internal/ui/styles.go` — `CellStyle` with `Background(ColorWarning)` and dark `Foreground` for contrast

**Dependencies:** None

**Done when:** Style constants compile and are importable from the `ui` package.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Duplicate Detection and Rendering

**Goal:** Detect duplicate plaintext assignments at render time and apply the warning style.

**Components:**
- `findDuplicateInputs()` function in `tui/internal/app/grid.go` — scans cells, returns `map[rune]bool` of plaintext letters mapped by 2+ cipher letters
- Updated `renderGrid()` in `tui/internal/app/grid.go` — calls `findDuplicateInputs()`, passes result to `renderLine()`
- Updated `renderLine()` signature in `tui/internal/app/grid.go` — accepts `duplicateInputs map[rune]bool`, passes to `renderInputCell()`
- Updated `renderInputCell()` in `tui/internal/app/grid.go` — adds duplicate check between active-cell and related-cell checks

**Dependencies:** Phase 1 (style definition)

**Done when:** Cells with duplicate plaintext assignments render with orange background. Detection tests cover: no inputs, all unique, single duplicate pair, multiple duplicates, cells with no input ignored. Style precedence tests cover: duplicate renders with warning style, cursor on duplicate uses active style, duplicate supersedes related style, non-duplicates unaffected.
<!-- END_PHASE_2 -->

## Additional Considerations

**Performance:** The duplicate scan adds one O(n) pass over cells per render. With n typically 100-300 and renders at 1 Hz (timer tick) or on keypress, this is negligible (microseconds).

**Backward compatibility for tests:** Existing tests that call `renderInputCell()` or `renderLine()` will need the new `duplicateInputs` parameter. Passing `nil` means "no duplicates," preserving existing behavior without changes to test logic.
