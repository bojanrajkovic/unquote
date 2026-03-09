import {
  test,
  expect,
  MOCK_PUZZLE,
  seedLocalStorage,
  mockApi,
  captureScreenshot,
} from "./fixtures.js";

test.describe("onboarding route", () => {
  // ── Task 1: Landing, Choose, and Redirect Tests ──

  test("playwright-e2e.AC2.1: landing page renders correctly", async ({
    page,
  }) => {
    // Navigate to /
    await page.goto("/");

    // Assert page contains text "Unquote" (title)
    const title = page.locator("h1", { hasText: "Unquote" });
    await expect(title).toBeVisible();

    // Assert "Play Today's Puzzle →" button is visible
    const playButton = page.locator("button", {
      hasText: "Play Today's Puzzle →",
    });
    await expect(playButton).toBeVisible();

    // Capture screenshot
    await captureScreenshot(page, "onboarding-landing.png");
  });

  test("playwright-e2e.AC2.2: Play Today's Puzzle advances to choose step", async ({
    page,
  }) => {
    // Navigate to /
    await page.goto("/");

    // Click "Play Today's Puzzle →"
    const playButton = page.locator("button", {
      hasText: "Play Today's Puzzle →",
    });
    await playButton.click();

    // Assert "Yes — create an account" is visible (choose step)
    const registerChoice = page.locator(".choice-card.choice-primary", {
      hasText: "Yes — create an account",
    });
    await expect(registerChoice).toBeVisible();

    // Assert "No thanks, just play" is visible
    const skipChoice = page.locator(".choice-card", {
      hasText: "No thanks, just play",
    });
    await expect(skipChoice).toBeVisible();

    // Assert "I already have a claim code" is visible
    const enterCodeChoice = page.locator(".choice-card", {
      hasText: "I already have a claim code",
    });
    await expect(enterCodeChoice).toBeVisible();

    // Capture screenshot
    await captureScreenshot(page, "onboarding-choose.png");
  });

  test("playwright-e2e.AC2.7: onboarded user redirected to /game", async ({
    page,
  }) => {
    // Seed mock API for puzzle (needed when /game loads)
    await mockApi(page, { sessionNotFound: true });

    // Navigate to /, seed localStorage with onboarded: true
    await page.goto("/");
    await seedLocalStorage(page, { onboarded: true });

    // Navigate to / again to trigger redirect guard
    await page.goto("/");

    // Assert URL changes to /game (redirect guard fires in +page.ts load function)
    await expect(page).toHaveURL("/game");
  });

  // ── Task 2: Register Flow and API Error Tests ──

  test("playwright-e2e.AC2.3: register flow shows claim code and navigates to /game", async ({
    page,
  }) => {
    // Navigate to /
    await page.goto("/");

    // Mock API endpoints before clicking
    await mockApi(page, {
      puzzle: MOCK_PUZZLE,
      sessionNotFound: true,
      registerResult: { claimCode: "AMBER-HAWK-7842" },
    });

    // Click "Play Today's Puzzle →" to reach choose step
    const playButton = page.locator("button", {
      hasText: "Play Today's Puzzle →",
    });
    await playButton.click();

    // Click "Yes — create an account"
    const registerChoice = page.locator(".choice-card.choice-primary", {
      hasText: "Yes — create an account",
    });
    await registerChoice.click();

    // Wait for .ticket-code to appear (registered step)
    const ticketCode = page.locator(".ticket-code");
    await expect(ticketCode).toBeVisible({ timeout: 10000 });

    // Assert .ticket-code contains "AMBER-HAWK-7842"
    await expect(ticketCode).toContainText("AMBER-HAWK-7842");

    // Capture screenshot
    await captureScreenshot(page, "onboarding-claim-code.png");

    // Click "Continue to Puzzle →"
    const continueButton = page.locator("button", {
      hasText: "Continue to Puzzle →",
    });
    await continueButton.click();

    // Assert URL is /game
    await expect(page).toHaveURL("/game");
  });

  test("playwright-e2e.AC2.8: registration API failure shows error and returns to choose", async ({
    page,
  }) => {
    // Navigate to /
    await page.goto("/");

    // Mock POST /player to return 500 error
    await page.route("**/player", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal Server Error" }),
        });
      }
      return route.continue();
    });

    // Click "Play Today's Puzzle →" to reach choose step
    const playButton = page.locator("button", {
      hasText: "Play Today's Puzzle →",
    });
    await playButton.click();

    // Click "Yes — create an account"
    const registerChoice = page.locator(".choice-card.choice-primary", {
      hasText: "Yes — create an account",
    });
    await registerChoice.click();

    // Wait for error message to appear
    const errorMessage = page.locator(".code-input-error");
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Assert the choose step options are still visible (step reverted to "choose")
    const registerChoiceAfter = page.locator(".choice-card.choice-primary", {
      hasText: "Yes — create an account",
    });
    await expect(registerChoiceAfter).toBeVisible();
    const skipChoiceAfter = page.locator(".choice-card", {
      hasText: "No thanks, just play",
    });
    await expect(skipChoiceAfter).toBeVisible();

    // Capture screenshot
    await captureScreenshot(page, "onboarding-register-error.png");
  });

  // ── Task 3: Skip and Enter-Code Flow Tests ──

  test("playwright-e2e.AC2.4: skip flow navigates to /game", async ({
    page,
  }) => {
    // Navigate to /
    await page.goto("/");

    // Mock API for game loading
    await mockApi(page, { sessionNotFound: true });

    // Click "Play Today's Puzzle →" to reach choose step
    const playButton = page.locator("button", {
      hasText: "Play Today's Puzzle →",
    });
    await playButton.click();

    // Click "No thanks, just play"
    const skipChoice = page.locator("div.choice-card", {
      hasText: "No thanks, just play",
    });
    await skipChoice.click();

    // Assert URL is /game
    await expect(page).toHaveURL("/game");
  });

  test("playwright-e2e.AC2.5: enter code flow with valid code navigates to /game", async ({
    page,
  }) => {
    // Navigate to /
    await page.goto("/");

    // Mock API for game loading
    await mockApi(page, { sessionNotFound: true });

    // Click "Play Today's Puzzle →" to reach choose step
    const playButton = page.locator("button", {
      hasText: "Play Today's Puzzle →",
    });
    await playButton.click();

    // Click "I already have a claim code"
    const enterCodeChoice = page.locator("div.choice-card", {
      hasText: "I already have a claim code",
    });
    await enterCodeChoice.click();

    // Wait for .code-input-field input to appear
    const codeInput = page.locator(".code-input-field");
    await expect(codeInput).toBeVisible({ timeout: 10000 });

    // Type "AMBER-HAWK-7842" into the input field
    await codeInput.fill("AMBER-HAWK-7842");

    // Capture screenshot BEFORE clicking Link Account
    await captureScreenshot(page, "onboarding-enter-code.png");

    // Click "Link Account →"
    const linkButton = page.locator("button.btn-link-account", {
      hasText: "Link Account →",
    });
    await linkButton.click();

    // Assert URL is /game
    await expect(page).toHaveURL("/game");
  });

  test("playwright-e2e.AC2.6: enter code with invalid format shows error", async ({
    page,
  }) => {
    // Navigate to /
    await page.goto("/");

    // Click "Play Today's Puzzle →" to reach choose step
    const playButton = page.locator("button", {
      hasText: "Play Today's Puzzle →",
    });
    await playButton.click();

    // Click "I already have a claim code"
    const enterCodeChoice = page.locator("div.choice-card", {
      hasText: "I already have a claim code",
    });
    await enterCodeChoice.click();

    // Wait for .code-input-field to appear
    const codeInput = page.locator(".code-input-field");
    await expect(codeInput).toBeVisible({ timeout: 10000 });

    // Type "INVALID" into the input field
    await codeInput.fill("INVALID");

    // Click "Link Account →"
    const linkButton = page.locator("button.btn-link-account", {
      hasText: "Link Account →",
    });
    await linkButton.click();

    // Assert .code-input-error is visible with an error message
    const errorMessage = page.locator(".code-input-error");
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(
      "Code must be in WORD-WORD-0000 format",
    );

    // Assert URL is still / (did NOT navigate)
    await expect(page).toHaveURL("/");

    // Capture screenshot
    await captureScreenshot(page, "onboarding-invalid-code.png");
  });
});
