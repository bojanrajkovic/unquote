import {
  test,
  expect,
  MOCK_STATS,
  MOCK_PUZZLE,
  MOCK_SOLVED_STATE,
  seedLocalStorage,
  mockApi,
} from "./fixtures.js";

test.describe("share card screenshots", () => {
  test("shareable-stats.AC5.1: stats share card renders with correct branding", async ({
    page,
  }) => {
    // Set claim code and onboarded flag in localStorage FIRST
    await page.goto("/");
    await seedLocalStorage(page);

    // Mock the stats API endpoint AFTER localStorage is set
    await mockApi(page, { stats: MOCK_STATS });

    // Navigate to stats page - this will trigger the load function which fetches stats
    await page.goto("/stats");

    // Wait for stats content to appear (either heading or stat tiles)
    await page.waitForSelector(".stats-heading, .stat-tile", {
      timeout: 15000,
    });

    // Find the off-screen share card container using the wrapper div
    const cardWrapper = page.locator('div:has(> [data-testid="stats-card"])');

    // Check if element exists
    const elementCount = await cardWrapper.count();
    expect(elementCount).toBeGreaterThan(0);

    // Store the text content BEFORE modifying styles
    const cardText = await cardWrapper.first().textContent();
    expect(cardText).toContain("UNQUOTE");
    expect(cardText).toContain("playunquote.com");
    expect(cardText).toContain("42"); // games played
    expect(cardText).toContain("90%"); // win rate

    // Now make it visible by modifying styles
    await cardWrapper.first().evaluate((el) => {
      (el as HTMLElement).style.position = "static";
      (el as HTMLElement).style.left = "auto";
      (el as HTMLElement).style.top = "auto";
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Wait for one animation frame to allow the browser to lay out the element
    // after style changes, ensuring the rendered dimensions match expectations
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );

    // Take element screenshot of the inner card (card is now visible after style changes)
    const cardEl = page.locator('[data-testid="stats-card"]');
    const screenshot = await cardEl.screenshot({
      path: "test-results/stats-share-card.png",
    });
    expect(screenshot).toBeTruthy();
  });

  test("shareable-stats.AC5.2: session share card renders with correct branding", async ({
    page,
  }) => {
    // Set up solved game state in localStorage FIRST
    await page.goto("/");
    await seedLocalStorage(page, { puzzleState: MOCK_SOLVED_STATE });

    // Mock the game API AFTER localStorage is set
    await mockApi(page, { puzzle: MOCK_PUZZLE, sessionNotFound: true });

    // Navigate to game page
    await page.goto("/game");
    await page.waitForSelector(".solved-card", { timeout: 15000 });

    // Find the off-screen share card container using the wrapper div
    const cardWrapper = page.locator('div:has(> [data-testid="session-card"])');

    // Check if element exists
    const elementCount = await cardWrapper.count();
    expect(elementCount).toBeGreaterThan(0);

    // Store the text content BEFORE modifying styles
    const cardText = await cardWrapper.first().textContent();
    expect(cardText).toContain("UNQUOTE");
    expect(cardText).toContain("playunquote.com");
    expect(cardText).toContain("SOLVED");

    // Now make it visible by modifying styles
    await cardWrapper.first().evaluate((el) => {
      (el as HTMLElement).style.position = "static";
      (el as HTMLElement).style.left = "auto";
      (el as HTMLElement).style.top = "auto";
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Wait for one animation frame to allow the browser to lay out the element
    // after style changes, ensuring the rendered dimensions match expectations
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );

    // Take element screenshot of the inner card (card is now visible after style changes)
    const cardEl = page.locator('[data-testid="session-card"]');
    const screenshot = await cardEl.screenshot({
      path: "test-results/session-share-card.png",
    });
    expect(screenshot).toBeTruthy();
  });
});
