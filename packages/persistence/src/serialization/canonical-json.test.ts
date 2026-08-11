import { describe, expect, it } from "vitest";
import { canonicalStringify } from "../index";

describe("canonicalStringify", () => {
  it("sorts object keys lexicographically", () => {
    expect(canonicalStringify({ zebra: 1, apple: 2, middle: 3 })).toBe(
      '{"apple":2,"middle":3,"zebra":1}',
    );
  });

  it("preserves array order", () => {
    expect(canonicalStringify({ cards: ["third", "first", "second"] })).toBe(
      '{"cards":["third","first","second"]}',
    );
  });

  it.each([
    {
      value: (() => {
        const array = [1, 0, 2];
        Reflect.deleteProperty(array, "1");
        return array;
      })(),
    },
    { value: new Array(1) },
  ])("rejects sparse arrays", ({ value }) => {
    expect(() => canonicalStringify(value)).toThrow();
  });

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects non-canonical value %s", (value) => {
    expect(() => canonicalStringify({ value })).toThrow();
  });
});
