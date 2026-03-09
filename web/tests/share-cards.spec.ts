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

    // Find the share card element
    const cardEl = page.locator('[data-testid="stats-card"]');
    await expect(cardEl).toBeAttached();

    // Verify card content BEFORE making visible
    const cardText = await cardEl.textContent();
    expect(cardText).toContain("UNQUOTE");
    expect(cardText).toContain("playunquote.com");
    expect(cardText).toContain("42"); // games played
    expect(cardText).toContain("90%"); // win rate

    // Move the off-screen wrapper on-screen (the outer div with left: -9999px)
    await cardEl.evaluate((el) => {
      const wrapper = el.closest('div[style*="-9999"]');
      if (wrapper instanceof HTMLElement) {
        wrapper.style.position = "fixed";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
        wrapper.style.zIndex = "99999";
      }
    });

    // Wait for fonts + layout
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(r));
    });

    // Take element screenshot
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

    // Find the share card element
    const cardEl = page.locator('[data-testid="session-card"]');
    await expect(cardEl).toBeAttached();

    // Verify card content BEFORE making visible
    const cardText = await cardEl.textContent();
    expect(cardText).toContain("UNQUOTE");
    expect(cardText).toContain("playunquote.com");
    expect(cardText).toContain("SOLVED");

    // Move the off-screen wrapper on-screen (the outer div with left: -9999px)
    await cardEl.evaluate((el) => {
      const wrapper = el.closest('div[style*="-9999"]');
      if (wrapper instanceof HTMLElement) {
        wrapper.style.position = "fixed";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
        wrapper.style.zIndex = "99999";
      }
    });

    // Wait for fonts + layout
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(r));
    });

    // Take element screenshot
    const screenshot = await cardEl.screenshot({
      path: "test-results/session-share-card.png",
    });
    expect(screenshot).toBeTruthy();
  });
});
