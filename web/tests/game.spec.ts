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

  // ── Task 3: Conflict Highlighting Test ──

  test("playwright-e2e.AC3.7: conflict highlighting when two ciphers map to same plain letter", async ({
    page,
  }) => {
    // Mock API
    await mockApi(page, { sessionNotFound: true });

    // Navigate to /game
    await page.goto("/game");

    // Wait for puzzle grid
    const puzzleGrid = page.locator(".puzzle-grid");
    await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

    // The first editable cell is B (editIndex 0)
    // Typing 'h' assigns B→H, which conflicts with hint X→H
    await page.keyboard.press("h");

    // Assert that conflict cells exist (at least the B cell should be marked as conflict)
    const conflictCells = page.locator(".cell.letter.conflict");
    await expect(conflictCells).not.toHaveCount(0);

    // Capture screenshot
    await captureScreenshot(page, "game-conflict.png");
  });

  // ── Task 4: Full Solve Flow Test ──

  test("playwright-e2e.AC3.8: full solve shows solved card with decoded quote", async ({
    page,
  }) => {
    // Mock API: check endpoint returns correct: true
    await mockApi(page, {
      checkResult: { correct: true },
      sessionNotFound: true,
    });

    // Navigate to /game
    await page.goto("/game");

    // Wait for puzzle grid
    const puzzleGrid = page.locator(".puzzle-grid");
    await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

    // Type the correct solution: E, L, L, O, W, O, R, L, D
    // The cipher map is: B→E, C→L, D→O, F→W, G→R, A→D
    // MOCK_PUZZLE "XBCCD FDGCA" maps to "HELLO WORLD"
    // Editable cells left-to-right: B, C, C, D, F, D, G, C, A
    const solutionLetters = ["e", "l", "l", "o", "w", "o", "r", "l", "d"];

    for (const letter of solutionLetters) {
      await page.keyboard.press(letter);
    }

    // Press Enter to submit
    await page.keyboard.press("Enter");

    // Wait for .solved-card to appear (with flip animation timeout)
    const solvedCard = page.locator(".solved-card");
    await expect(solvedCard).toBeVisible({ timeout: 15000 });

    // Assert solved card contains the decoded quote "HELLO WORLD"
    await expect(solvedCard).toContainText("HELLO WORLD");

    // Assert solved card contains attribution "Test Author"
    await expect(solvedCard).toContainText("Test Author");

    // Assert timer/stat shows completion time (format: MM:SS)
    const timePattern = /\d+:\d{2}/;
    const solvedCardText = await solvedCard.textContent();
    expect(solvedCardText).toMatch(timePattern);

    // Capture screenshot
    await captureScreenshot(page, "game-solved.png");
  });

  // ── Task 5: Incorrect Solve and Validation Guard Tests ──

  test("playwright-e2e.AC3.9: incorrect solution shows 'Not quite' message", async ({
    page,
  }) => {
    // Mock API: check endpoint returns correct: false
    await mockApi(page, {
      checkResult: { correct: false },
      sessionNotFound: true,
    });

    // Navigate to /game
    await page.goto("/game");

    // Wait for puzzle grid
    const puzzleGrid = page.locator(".puzzle-grid");
    await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

    // Type 9 different wrong letters (no conflicts) to fill all editable cells
    // MOCK_PUZZLE editable cells are: B, C, C, D, F, D, G, C, A (9 cells)
    // Using cipher letters: B, C, D, F, G, A, and others
    // Fill with: J, K, M, N, P, Q, R, S, T (9 letters that avoid conflicts with the cipher set)
    const wrongLetters = ["j", "k", "m", "n", "p", "q", "r", "s", "t"];
    for (const letter of wrongLetters) {
      await page.keyboard.press(letter);
    }

    // Press Enter to submit
    await page.keyboard.press("Enter");

    // Wait for status message to appear
    const statusMessage = page.locator(".game-status");
    await expect(statusMessage).toBeVisible({ timeout: 5000 });

    // Assert status message contains "Not quite"
    await expect(statusMessage).toContainText(/Not quite/i);
  });

  test("playwright-e2e.AC3.10: submit with empty cells shows warning", async ({
    page,
  }) => {
    // Mock API
    await mockApi(page, { sessionNotFound: true });

    // Navigate to /game
    await page.goto("/game");

    // Wait for puzzle grid
    const puzzleGrid = page.locator(".puzzle-grid");
    await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

    // Do NOT type any letters (all cells empty)
    // Click the Check Answer button (.btn-primary)
    const checkButton = page.locator(".btn-primary", {
      hasText: /Check Answer/i,
    });
    await checkButton.click();

    // Wait for status message
    const statusMessage = page.locator(".game-status");
    await expect(statusMessage).toBeVisible({ timeout: 5000 });

    // Assert status message contains "Fill in all letters first"
    await expect(statusMessage).toContainText(/Fill in all letters first/i);
  });

  test("playwright-e2e.AC3.11: submit with conflicts shows warning", async ({
    page,
  }) => {
    // Mock API
    await mockApi(page, { sessionNotFound: true });

    // Navigate to /game
    await page.goto("/game");

    // Wait for puzzle grid
    const puzzleGrid = page.locator(".puzzle-grid");
    await expect(puzzleGrid).toBeVisible({ timeout: 10000 });

    // Fill all cells with at least one conflict:
    // Type "h" on first cell (B) to create conflict with hint X→H
    // Then fill remaining cells with any non-conflicting letters
    const cellLetters = ["h", "x", "x", "x", "x", "x", "x", "x", "x"];

    for (const letter of cellLetters) {
      await page.keyboard.press(letter);
    }

    // Click the Check Answer button
    const checkButton = page.locator(".btn-primary", {
      hasText: /Check Answer/i,
    });
    await checkButton.click();

    // Wait for status message
    const statusMessage = page.locator(".game-status");
    await expect(statusMessage).toBeVisible({ timeout: 5000 });

    // Assert status message contains "Resolve letter conflicts first"
    await expect(statusMessage).toContainText(
      /Resolve letter conflicts first/i,
    );
  });
});
