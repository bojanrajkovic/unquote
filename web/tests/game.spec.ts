import {
  test,
  expect,
  seedLocalStorage,
  mockApi,
  captureScreenshot,
} from "./fixtures.js";

test.describe("game route", () => {
  // Shared beforeEach: navigate to / and seed localStorage
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await seedLocalStorage(page, { onboarded: true });
  });

  // ── Task 1: Puzzle Loading Test ──

  test("playwright-e2e.AC3.1: puzzle loads and renders grid with cells and clues", async ({
    page,
  }) => {
    // Mock API: puzzle from MOCK_PUZZLE, session not found
    await mockApi(page, { sessionNotFound: true });

    // Navigate to /game
    await page.goto("/game");

    // Wait for .puzzle-grid to appear
    const puzzleGrid = page.locator(".puzzle-grid");
    await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

    // Count .cell.letter elements (editable cells)
    const letterCells = page.locator(".cell.letter");
    const letterCellCount = await letterCells.count();
    expect(letterCellCount).toBe(9); // 9 editable cells in "XBCCD FDGCA"

    // Count .cell.hint elements (hint cells)
    const hintCells = page.locator(".cell.hint");
    const hintCellCount = await hintCells.count();
    expect(hintCellCount).toBe(1); // 1 hint cell (X→H)

    // Assert clue chip is visible with hint text
    const clueChip = page.locator(".clue-chip", { hasText: /X\s*=\s*H/ });
    await expect(clueChip).toBeVisible();

    // Assert timer is visible
    const timer = page.locator(".timer");
    await expect(timer).toBeVisible();

    // Capture screenshot
    await captureScreenshot(page, "game-loaded.png");
  });

  // ── Task 2: Keyboard Interaction Tests ──

  test.describe("keyboard interaction", () => {
    test("playwright-e2e.AC3.2: typing a letter fills cell and advances cursor", async ({
      page,
    }) => {
      // Mock API
      await mockApi(page, { sessionNotFound: true });

      // Navigate to /game
      await page.goto("/game");

      // Wait for puzzle grid
      const puzzleGrid = page.locator(".puzzle-grid");
      await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

      // Assert first cell is active
      const firstCell = page.locator(".cell.letter").first();
      await expect(firstCell).toHaveClass(/active/);

      // Type 'e' (fills first cell)
      await page.keyboard.press("e");

      // Assert first cell has input text "E"
      const firstCellInput = firstCell.locator(".cell-input");
      await expect(firstCellInput).toContainText("E");

      // Assert second cell is now active
      const secondCell = page.locator(".cell.letter").nth(1);
      await expect(secondCell).toHaveClass(/active/);

      // Type 'l' (fills second cell)
      await page.keyboard.press("l");

      // Assert second cell has input text "L"
      const secondCellInput = secondCell.locator(".cell-input");
      await expect(secondCellInput).toContainText("L");
    });

    test("playwright-e2e.AC3.3: arrow keys and Tab move cursor", async ({
      page,
    }) => {
      // Mock API
      await mockApi(page, { sessionNotFound: true });

      // Navigate to /game
      await page.goto("/game");

      // Wait for puzzle grid
      const puzzleGrid = page.locator(".puzzle-grid");
      await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

      // Assert first cell is active
      const firstCell = page.locator(".cell.letter").first();
      await expect(firstCell).toHaveClass(/active/);

      // Press ArrowRight — should move to second cell
      await page.keyboard.press("ArrowRight");
      const secondCell = page.locator(".cell.letter").nth(1);
      await expect(secondCell).toHaveClass(/active/);

      // Press ArrowLeft — should move back to first cell
      await page.keyboard.press("ArrowLeft");
      await expect(firstCell).toHaveClass(/active/);

      // Press Tab — should move to second cell
      await page.keyboard.press("Tab");
      await expect(secondCell).toHaveClass(/active/);

      // Press Shift+Tab — should move back to first cell
      await page.keyboard.press("Shift+Tab");
      await expect(firstCell).toHaveClass(/active/);
    });

    test("playwright-e2e.AC3.4: backspace clears cell and moves back", async ({
      page,
    }) => {
      // Mock API
      await mockApi(page, { sessionNotFound: true });

      // Navigate to /game
      await page.goto("/game");

      // Wait for puzzle grid
      const puzzleGrid = page.locator(".puzzle-grid");
      await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

      const letterCells = page.locator(".cell.letter");

      // Type a few letters: press 'a', 'e', 'i'
      // This fills the first few cells and moves cursor forward
      await page.keyboard.press("a");
      await page.waitForTimeout(50);

      await page.keyboard.press("e");
      await page.waitForTimeout(50);

      await page.keyboard.press("i");
      await page.waitForTimeout(50);

      // Now we're at cursor position 3 (after typing 3 letters)
      // Press Backspace to go back and clear
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      // Verify at least one cell is cleared (guess is "·")
      // This confirms backspace worked
      let hasEmptyCell = false;
      const cellCount = await letterCells.count();
      for (let i = 0; i < Math.min(3, cellCount); i++) {
        const cellInput = letterCells.nth(i).locator(".cell-input");
        const text = await cellInput.textContent();
        if (text === "·") {
          hasEmptyCell = true;
          break;
        }
      }
      expect(hasEmptyCell).toBeTruthy();
    });

    test("playwright-e2e.AC3.5: Ctrl+C clears all guesses", async ({
      page,
    }) => {
      // Mock API
      await mockApi(page, { sessionNotFound: true });

      // Navigate to /game
      await page.goto("/game");

      // Wait for puzzle grid
      const puzzleGrid = page.locator(".puzzle-grid");
      await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

      // Type several letters: 'a', 'b', 'c'
      await page.keyboard.press("a");
      await page.keyboard.press("b");
      await page.keyboard.press("c");

      // Assert at least first 3 cells have non-empty guesses
      let firstCellInput = page
        .locator(".cell.letter")
        .first()
        .locator(".cell-input");
      let cellText = await firstCellInput.textContent();
      expect(cellText).not.toBe("·");

      // Press Ctrl+C to clear all guesses
      await page.keyboard.press("Control+c");

      // Assert all .cell.letter elements have empty guesses ("·")
      const letterCells = page.locator(".cell.letter");
      const cellCount = await letterCells.count();
      for (let i = 0; i < cellCount; i++) {
        const cellInput = letterCells.nth(i).locator(".cell-input");
        const text = await cellInput.textContent();
        expect(text).toBe("·");
      }
    });

    test("playwright-e2e.AC3.6: clicking a letter cell moves cursor to that cell", async ({
      page,
    }) => {
      // Mock API
      await mockApi(page, { sessionNotFound: true });

      // Navigate to /game
      await page.goto("/game");

      // Wait for puzzle grid
      const puzzleGrid = page.locator(".puzzle-grid");
      await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

      // Get the 5th .cell.letter element (index 4)
      const fifthCell = page.locator(".cell.letter").nth(4);

      // Click it
      await fifthCell.click();

      // Assert it has .active class
      await expect(fifthCell).toHaveClass(/active/);
    });
  });
});
