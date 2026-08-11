import {
  DeterministicRng,
  deriveSeed,
} from "../../packages/rules-engine/src/rng/deterministic-rng";
import { describe, expect, it } from "vitest";

describe("browser-safe deterministic RNG", () => {
  it("preserves the versioned integer sequence without Node-only primitives", () => {
    const rng = new DeterministicRng(deriveSeed(["browser-safe", 999]));

    expect(Array.from({ length: 4 }, () => rng.nextUint64())).toEqual([
      13236072246002890826n,
      441620361135445773n,
      2673483619205189223n,
      11832654329281002397n,
    ]);
  });
});
