import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captureElementAsBlob } from "./capture";

// modern-screenshot requires canvas rendering which isn't available in jsdom
// These tests verify the module structure and error handling.
// Canvas-based rendering is tested in E2E tests.
describe("captureElementAsBlob", () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    mockElement = document.createElement("div");
    mockElement.textContent = "Test card";
    document.body.appendChild(mockElement);

    // Mock document.fonts.ready
    Object.defineProperty(document, "fonts", {
      value: {
        ready: Promise.resolve(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    if (mockElement.parentNode) {
      mockElement.parentNode.removeChild(mockElement);
    }
  });

  it("AC1.1: handles missing canvas gracefully in jsdom environment (returns null)", async () => {
    // In jsdom, canvas is not available, so domToBlob fails and we return null
    const result = await captureElementAsBlob(mockElement);
    expect(result).toBeNull();
  });
});
