import { describe, expect, it } from "vitest";
import { parseSeedArg } from "../../scripts/simulate-match";

describe("headless match CLI", () => {
  it("parses an integer seed argument", () => {
    expect(parseSeedArg(["--seed", "12345"])).toBe(12345n);
  });

  it("rejects a non-integer seed argument", () => {
    expect(() => parseSeedArg(["--seed", "abc"])).toThrow();
  });
});
