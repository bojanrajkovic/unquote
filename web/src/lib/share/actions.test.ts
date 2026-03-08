import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyImageToClipboard, downloadBlob } from "./actions";

describe("copyImageToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC1.1: returns true on successful clipboard copy", async () => {
    // Mock ClipboardItem for jsdom
    if (typeof ClipboardItem === "undefined") {
      Object.defineProperty(globalThis, "ClipboardItem", {
        value: class {
          constructor(_data: Record<string, Blob>) {}
        },
        writable: true,
        configurable: true,
      });
    }

    const mockWrite = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;

    Object.defineProperty(navigator, "clipboard", {
      value: { write: mockWrite },
      writable: true,
      configurable: true,
    });

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      const result = await copyImageToClipboard(blob);
      expect(result).toBe(true);
      expect(mockWrite).toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    }
  });

  it("AC2.1: returns false on clipboard failure", async () => {
    const mockWrite = vi
      .fn()
      .mockRejectedValue(new Error("clipboard unavailable"));
    const originalClipboard = navigator.clipboard;

    Object.defineProperty(navigator, "clipboard", {
      value: { write: mockWrite },
      writable: true,
      configurable: true,
    });

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      const result = await copyImageToClipboard(blob);
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    }
  });
});

describe("downloadBlob", () => {
  beforeEach(() => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("AC1.1: creates download link and triggers click", () => {
    const clickSpy = vi.fn();
    const mockElement = {
      href: "",
      download: "",
      click: clickSpy,
    } as any;

    const createElementSpy = vi.spyOn(document, "createElement");
    createElementSpy.mockReturnValueOnce(mockElement);

    const blob = new Blob(["test"], { type: "image/png" });
    downloadBlob(blob, "test.png");

    expect(mockElement.download).toBe("test.png");
    expect(clickSpy).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith("a");
  });
});
