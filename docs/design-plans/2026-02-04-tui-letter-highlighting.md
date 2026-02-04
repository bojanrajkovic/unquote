# TUI Letter Highlighting Design

## Summary

This design adds visual highlighting to the TUI that shows all cells sharing the same cipher letter when the cursor moves. When a player places their cursor on any letter cell, every other occurrence of that encrypted letter throughout the puzzle receives a subtle background highlight, helping players track which letters they're decoding together. The active cursor cell retains its distinct bold purple styling, while related cells use a lighter background tint to differentiate them.

The implementation leverages the existing render pipeline in `grid.go` without adding new model state. During each render pass, the view derives the "highlight character" from the cell at the current cursor position, then applies conditional styling as it renders each cell. This approach keeps the logic contained within the view layer and works seamlessly with the existing word-wrapping and cell navigation systems.

## Definition of Done
- When cursor is on a cell, all cells with the same cipher letter are visually highlighted
- Active cell has distinct style from related cells
- Highlighting updates dynamically as cursor moves
- Works across word-wrapped lines

## Glossary

- **Bubble Tea**: Go framework implementing the Elm Architecture (Model-View-Update pattern) for building terminal user interfaces
- **Lip Gloss**: Go library for terminal styling and layout, providing chainable methods for colors, borders, padding, and alignment
- **Cipher letter**: The encrypted letter in a cryptoquip puzzle (the scrambled version before player substitution)
- **Cell**: A single character position in the puzzle grid, containing the cipher letter, player input, and metadata like position index
- **Active cell**: The cell currently under the cursor where the player can type input
- **Related cells**: All cells that share the same cipher letter as the active cell
- **Render pipeline**: The View() function execution path that converts model state into terminal output on each screen update

## Architecture

Visual highlighting of related cipher letters derived from cursor position. When cursor is on a cell, all cells sharing the same cipher letter receive a distinct highlight style.

**Key components:**

1. **Related cell style** (`tui/internal/ui/styles.go`): New `RelatedCellStyle` visually distinct from `ActiveCellStyle`. Uses background tint without bold to differentiate from cursor.

2. **Highlight logic** (`tui/internal/app/grid.go`): In `renderInputCell`, check if `cell.Char == highlightChar && cell.Index != m.cursorPos` to apply `RelatedCellStyle`.

3. **Highlight character derivation** (`tui/internal/app/grid.go`): Get highlight character from `m.cells[m.cursorPos].Char` at render time. No new model state needed.

**Data flow:**
```
View() called → Get highlightChar from m.cells[m.cursorPos] →
Check m.cells[m.cursorPos].IsLetter (skip if false) →
Pass highlightChar to renderGrid → Each renderInputCell checks cell.Char →
Apply RelatedCellStyle if cell.Char == highlightChar && cell.Index != cursorPos
```

**Edge cases:**
- Cursor on non-letter cell: `IsLetter == false` means no highlighting (highlightChar is zero value)
- Single occurrence of cipher letter: Only active cell highlighted (no related cells)
- Multiple lines: Works naturally since highlighting checks cell.Char regardless of line position

## Existing Patterns

Investigation found existing cell styling in `tui/internal/ui/styles.go`:
- `CellStyle` — base cell styling (width: 3, center-aligned)
- `ActiveCellStyle` — cursor cell (purple foreground, white background, bold)

This design follows the same pattern, adding `RelatedCellStyle` alongside existing styles.

Highlight logic follows existing conditional styling pattern in `renderInputCell` (`grid.go:53-72`) which already checks `cell.Index == m.cursorPos` for active cell styling.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Add Related Cell Style
**Goal:** Define visual style for related (same cipher letter) cells

**Components:**
- `tui/internal/ui/styles.go` — add `RelatedCellStyle` with accessible colors (4.5:1+ contrast ratio)

**Dependencies:** None

**Done when:** `RelatedCellStyle` exported and available for use
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Highlight Logic in Render
**Goal:** Apply related cell highlighting during grid render

**Components:**
- `tui/internal/app/grid.go` — derive `highlightChar` from `m.cells[m.cursorPos]`
- `tui/internal/app/grid.go` — modify `renderInputCell` to check for related cells
- `tui/internal/app/grid.go` — apply `RelatedCellStyle` when conditions match

**Dependencies:** Phase 1 (style available)

**Done when:** Moving cursor highlights all cells with same cipher letter, active cell remains visually distinct, non-letter cursor positions show no highlighting
<!-- END_PHASE_2 -->

## Additional Considerations

**Accessibility:** `RelatedCellStyle` uses background-only styling (no bold) to ensure visual distinction from the active cell. Terminal color schemes vary, making specific contrast ratios dependent on user configuration.

**Performance:** Highlight character derived at render time adds negligible overhead. Single comparison per cell during existing render loop.
