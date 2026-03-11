import {
  test,
  expect,
  captureScreenshot,
  seedLocalStorage,
} from "./fixtures.js";

test.describe("faq route", () => {
  // ── Task 4: FAQ Page Tests ──

  test("playwright-e2e.AC5.1: FAQ page renders static content", async ({
    page,
  }) => {
    // Navigate to /faq
    await page.goto("/faq");

    // Assert page contains "FAQ" text (title or heading)
    const faqTitle = page.locator("h1", {
      hasText: "What would you like to know?",
    });
    await expect(faqTitle).toBeVisible();

    // Assert at least one accordion section heading is visible (e.g., "How to Play")
    const gameplaySection = page.locator("h2", { hasText: "How to Play" });
    await expect(gameplaySection).toBeVisible();

    // Capture screenshot
    await captureScreenshot(page, "faq-page.png");
  });

  test("playwright-e2e.AC5.2: navigation links are present and functional", async ({
    page,
  }) => {
    // Seed localStorage as non-onboarded for predictable behavior
    await page.goto("/faq");
    await seedLocalStorage(page, { onboarded: false, claimCode: null });

    // Reload page to apply seeded localStorage
    await page.goto("/faq");

    // Assert .compact-logo link is visible with text "Unquote" and href="/"
    const logoLink = page.locator("a.compact-logo", { hasText: "Unquote" });
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute("href", "/");

    // Assert "← Puzzle" link is visible with class .btn-back
    const puzzleLink = page.locator("a.btn-back", { hasText: "← Puzzle" });
    await expect(puzzleLink).toBeVisible();

    // Click the logo link
    await logoLink.click();

    // Assert URL navigates to / (non-onboarded users go to /, onboarded go to /game)
    await expect(page).toHaveURL("/");
  });
});
