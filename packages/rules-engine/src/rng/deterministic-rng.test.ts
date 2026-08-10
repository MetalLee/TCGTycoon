import { describe, expect, it } from "vitest";

import { DeterministicRng, deriveSeed } from "./deterministic-rng";

describe("DeterministicRng", () => {
  it("returns the same sequence for the same seed", () => {
    const seed = deriveSeed(["world-1", 7, "match-42"]);
    const a = new DeterministicRng(seed);
    const b = new DeterministicRng(seed);

    expect([a.nextInt(100), a.nextInt(100), a.nextFloat()]).toEqual([
      b.nextInt(100),
      b.nextInt(100),
      b.nextFloat(),
    ]);
  });

  it("derives different seeds for different stable parts", () => {
    expect(deriveSeed(["world", 1])).not.toBe(deriveSeed(["world", 2]));
  });
});
