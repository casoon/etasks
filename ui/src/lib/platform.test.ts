import { describe, it, expect } from "vitest";
import { isMac, quickAddShortcutLabel } from "./platform";

describe("quickAddShortcutLabel", () => {
  it("uses Cmd on macOS and Strg elsewhere", () => {
    expect(isMac("MacIntel")).toBe(true);
    expect(isMac("Win32")).toBe(false);
    expect(quickAddShortcutLabel(true)).toBe("⌘K");
    expect(quickAddShortcutLabel(false)).toBe("Strg+K");
  });
});
