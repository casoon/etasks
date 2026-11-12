import { describe, expect, it } from "vitest";
import { csvEscape } from "./csv";

describe("csvEscape", () => {
  it("passes plain values through", () => {
    expect(csvEscape("Aufgabe")).toBe("Aufgabe");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
    expect(csvEscape(90)).toBe("90");
  });

  it("neutralizes formula starters in text", () => {
    for (const bad of ["=1+1", "+49 170", "-2+3", "@SUM(A1)", "\tx", "\rx"]) {
      expect(csvEscape(bad).replace(/^"/, "")).toMatch(/^'/);
    }
    expect(csvEscape("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
  });

  it("keeps negative numbers numeric", () => {
    expect(csvEscape(-5)).toBe("-5");
  });

  it("quotes separators, quotes, CR and LF", () => {
    expect(csvEscape("a;b")).toBe('"a;b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape("a\nb")).toBe('"a\nb"');
    expect(csvEscape("a\rb")).toBe('"a\rb"');
  });

  it("does not prefix a dash inside text", () => {
    expect(csvEscape("Phase 1 - Design")).toBe("Phase 1 - Design");
  });
});
