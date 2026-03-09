import {
  test,
  expect,
  captureScreenshot,
  seedLocalStorage,
  mockApi,
  MOCK_STATS,
  MOCK_CLAIM_CODE,
} from "./fixtures.js";

test.describe("stats route", () => {
  // ── Task 1: Primary Tiles, Chart, and Secondary Stats Tests ──

  test("playwright-e2e.AC4.1: stats page renders primary tiles with correct values", async ({
    page,
  }) => {
    // Navigate to /, seed localStorage with onboarded: true and claim code
    await page.goto("/");
    await seedLocalStorage(page, {
      onboarded: true,
      claimCode: MOCK_CLAIM_CODE,
    });

    // Mock stats API
    await mockApi(page, { stats: MOCK_STATS });

    // Navigate to /stats
    await page.goto("/stats");

    // Wait for .stat-tile to appear
    const statTiles = page.locator(".stat-tile");
    await expect(statTiles.first()).toBeVisible({ timeout: 15000 });

    // Assert 4 .stat-tile elements exist
    await expect(statTiles).toHaveCount(4);

    // Assert tile values contain correct data
    // Games played: 42
    await expect(statTiles.nth(0)).toContainText("42");
    // Games solved: 38
    await expect(statTiles.nth(1)).toContainText("38");
    // Win rate: 90%
    await expect(statTiles.nth(2)).toContainText("90%");
    // Current streak: 12
    await expect(statTiles.nth(3)).toContainText("12");

    // Capture screenshot
    await captureScreenshot(page, "stats-primary-tiles.png");
  });

  test("playwright-e2e.AC4.2: chart renders with solve time data points", async ({
    page,
  }) => {
    // Navigate to /, seed localStorage with onboarded: true and claim code
    await page.goto("/");
    await seedLocalStorage(page, {
      onboarded: true,
      claimCode: MOCK_CLAIM_CODE,
    });

    // Mock stats API (MOCK_STATS has 3 recentSolves entries)
    await mockApi(page, { stats: MOCK_STATS });

    // Navigate to /stats
    await page.goto("/stats");

    // Wait for chart panel to appear
    const chartPanel = page.locator(".chart-panel");
    await expect(chartPanel).toBeVisible({ timeout: 15000 });

    // Assert .chart-svg exists
    const chartSvg = page.locator(".chart-svg");
    await expect(chartSvg).toBeVisible();

    // Assert .chart-title text contains "Solve Times"
    const chartTitle = page.locator(".chart-title");
    await expect(chartTitle).toContainText("Solve Times");

    // Assert SVG contains circle elements (data point dots)
    // The chart may contain more than 3 circles (e.g., grid or axis elements),
    // but we verify at least 3 are present for the data points
    const circles = page.locator(".chart-svg circle");
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThanOrEqual(3);

    // Capture screenshot
    await captureScreenshot(page, "stats-chart.png");
  });

  test("playwright-e2e.AC4.3: secondary stats render with correct values", async ({
    page,
  }) => {
    // Navigate to /, seed localStorage with onboarded: true and claim code
    await page.goto("/");
    await seedLocalStorage(page, {
      onboarded: true,
      claimCode: MOCK_CLAIM_CODE,
    });

    // Mock stats API
    await mockApi(page, { stats: MOCK_STATS });

    // Navigate to /stats
    await page.goto("/stats");

    // Wait for secondary stats section to appear
    const secondaryStats = page.locator(".stats-secondary");
    await expect(secondaryStats).toBeVisible({ timeout: 15000 });

    // Assert stat row for "Streaks" contains correct values
    const streaksRow = page.locator(".stats-secondary").locator("text=Streaks");
    await expect(streaksRow).toBeVisible();
    // Current streak: 12
    const streakValues = page.locator(".stats-secondary").locator("text=12");
    await expect(streakValues).toContainText("12");
    // Best streak: 18
    const bestStreakValues = page
      .locator(".stats-secondary")
      .locator("text=18");
    await expect(bestStreakValues).toContainText("18");

    // Assert stat row for "Times" contains formatted values
    const timesRow = page.locator(".stats-secondary").locator("text=Times");
    await expect(timesRow).toBeVisible();
    // Best time: 102000ms = "1:42"
    await expect(page.locator(".stats-secondary")).toContainText("1:42");
    // Average time: 151000ms = "2:31"
    await expect(page.locator(".stats-secondary")).toContainText("2:31");
  });

  // ── Task 2: Empty State and API Error Tests ──

  test("playwright-e2e.AC4.4: no claim code shows empty state with CTA", async ({
    page,
  }) => {
    // Navigate to /, seed localStorage with onboarded: true but NO claim code
    await page.goto("/");
    await seedLocalStorage(page, { onboarded: true, claimCode: null });

    // Navigate to /stats
    await page.goto("/stats");

    // Wait for empty state to appear
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible({ timeout: 15000 });

    // Assert .empty-message contains text about creating an account
    const emptyMessage = page.locator(".empty-message");
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toContainText(/create.*account/i);

    // Assert .register-cta link is visible with text "create account"
    const registerCta = page.locator(".register-cta");
    await expect(registerCta).toBeVisible();
    await expect(registerCta).toContainText("create account");
    await expect(registerCta).toHaveAttribute("href", /action=register/);

    // Capture screenshot
    await captureScreenshot(page, "stats-empty-state.png");
  });

  test("playwright-e2e.AC4.5: API error shows error message", async ({
    page,
  }) => {
    // Navigate to /, seed localStorage with onboarded: true and claim code
    await page.goto("/");
    await seedLocalStorage(page, {
      onboarded: true,
      claimCode: MOCK_CLAIM_CODE,
    });

    // Mock stats API to return 500 error
    await page.route("**/player/*/stats", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      }),
    );

    // Navigate to /stats
    await page.goto("/stats");

    // Wait for empty state to appear (error uses same layout container)
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible({ timeout: 15000 });

    // Assert .error-message is visible with error text
    const errorMessage = page.locator(".error-message");
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/could not load|error|failed/i);

    // Capture screenshot
    await captureScreenshot(page, "stats-error.png");
  });
});
