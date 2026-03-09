import { describe, it, expect, vi, afterEach } from "vitest";
import { canCopyImage, canNativeShare } from "./detect";

describe("canCopyImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC1.9: returns true when ClipboardItem and navigator.clipboard.write are available", () => {
    // Ensure navigator and ClipboardItem are defined
    if (typeof ClipboardItem === "undefined") {
      Object.defineProperty(globalThis, "ClipboardItem", {
        value: class {
          constructor(_data: Record<string, Blob>) {}
        },
        writable: true,
        configurable: true,
      });
    }

    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { write: vi.fn() },
      writable: true,
      configurable: true,
    });

    try {
      const result = canCopyImage();
      expect(result).toBe(true);
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when navigator is undefined", () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = canCopyImage();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when ClipboardItem is not available", () => {
    const originalClipboardItem = globalThis.ClipboardItem;
    Object.defineProperty(globalThis, "ClipboardItem", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = canCopyImage();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "ClipboardItem", {
        value: originalClipboardItem,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when navigator.clipboard is not available", () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = canCopyImage();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when navigator.clipboard.write is not a function", () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { write: "not a function" },
      writable: true,
      configurable: true,
    });

    try {
      const result = canCopyImage();
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

describe("canNativeShare", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC1.9: returns true when navigator.share and navigator.canShare support files", () => {
    const mockCanShare = vi.fn().mockReturnValue(true);
    const originalNavigator = navigator;

    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: vi.fn(),
        canShare: mockCanShare,
      },
      writable: true,
      configurable: true,
    });

    try {
      const result = canNativeShare();
      expect(result).toBe(true);
      expect(mockCanShare).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when navigator is undefined", () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = canNativeShare();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when navigator.share is not available", () => {
    const originalNavigator = navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: undefined,
        canShare: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    try {
      const result = canNativeShare();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when navigator.canShare is not available", () => {
    const originalNavigator = navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: vi.fn(),
        canShare: undefined,
      },
      writable: true,
      configurable: true,
    });

    try {
      const result = canNativeShare();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when canShare returns false", () => {
    const mockCanShare = vi.fn().mockReturnValue(false);
    const originalNavigator = navigator;

    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: vi.fn(),
        canShare: mockCanShare,
      },
      writable: true,
      configurable: true,
    });

    try {
      const result = canNativeShare();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it("shareable-stats.AC1.9: returns false when canShare throws an error", () => {
    const mockCanShare = vi.fn().mockImplementation(() => {
      throw new Error("canShare failed");
    });
    const originalNavigator = navigator;

    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        share: vi.fn(),
        canShare: mockCanShare,
      },
      writable: true,
      configurable: true,
    });

    try {
      const result = canNativeShare();
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });
});
