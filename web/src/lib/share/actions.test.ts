import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  copyImageToClipboard,
  downloadBlob,
  nativeShareImage,
} from "./actions";

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

describe("nativeShareImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC1.6: returns true on successful share", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    const originalNavigator = navigator;

    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: mockShare,
      },
      writable: true,
      configurable: true,
    });

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      const result = await nativeShareImage(
        blob,
        "test.png",
        "Test Title",
        "Test Text",
      );
      expect(result).toBe(true);
      expect(mockShare).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("AC1.6: returns true on user cancel (AbortError)", async () => {
    const abortError = new DOMException("User cancelled", "AbortError");
    const mockShare = vi.fn().mockRejectedValue(abortError);
    const originalNavigator = navigator;

    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: mockShare,
      },
      writable: true,
      configurable: true,
    });

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      const result = await nativeShareImage(
        blob,
        "test.png",
        "Test Title",
        "Test Text",
      );
      expect(result).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("AC1.10: returns false on share failure (non-AbortError)", async () => {
    const mockShare = vi.fn().mockRejectedValue(new Error("Share failed"));
    const originalNavigator = navigator;

    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: mockShare,
      },
      writable: true,
      configurable: true,
    });

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      const result = await nativeShareImage(
        blob,
        "test.png",
        "Test Title",
        "Test Text",
      );
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.6: passes blob as File to navigator.share", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    const originalNavigator = navigator;

    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: mockShare,
      },
      writable: true,
      configurable: true,
    });

    try {
      const blob = new Blob(["test"], { type: "image/png" });
      await nativeShareImage(blob, "test.png", "Test Title", "Test Text");

      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Title",
          text: "Test Text",
          files: expect.arrayContaining([expect.any(File)]),
        }),
      );

      const callArgs = mockShare.mock.calls[0][0];
      expect(callArgs.files[0].name).toBe("test.png");
      expect(callArgs.files[0].type).toBe("image/png");
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });
});
