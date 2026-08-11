import { createHash } from "node:crypto";
import {
  simulateMatch,
  type BattleStrategy,
  type MatchInput,
} from "../../packages/rules-engine/src/battle/match-engine";
import {
  canonicalSerialize,
  hashMatchResult,
} from "../../packages/rules-engine/src/replay/hash-result";
import {
  coreCardFixtures,
  fireFixtureDeck,
  machineFixtureDeck,
} from "../../packages/testkit/src";
import { describe, expect, it } from "vitest";

const baselineStrategy: BattleStrategy = {
  aggression: 0.5,
  value: 0.5,
  preservation: 0.5,
};

function fixtureMatchInput(seed: bigint): MatchInput {
  return {
    seed,
    deckA: fireFixtureDeck,
    deckB: machineFixtureDeck,
    cards: new Map(coreCardFixtures.map((card) => [card.id, card])),
    strategyA: baselineStrategy,
    strategyB: baselineStrategy,
    recordActionLog: true,
  };
}

describe("match determinism", () => {
  it("produces one result hash across 100 identical runs", () => {
    const hashes = new Set(
      Array.from({ length: 100 }, () =>
        hashMatchResult(simulateMatch(fixtureMatchInput(999n))),
      ),
    );

    expect(hashes.size).toBe(1);
  });

  it("round-trips the compact action log through JSON", () => {
    const { actionLog } = simulateMatch(fixtureMatchInput(999n));

    expect(actionLog).toBeDefined();
    expect(JSON.parse(JSON.stringify(actionLog))).toEqual(actionLog);
  });

  it("sorts canonical object keys and matches Node SHA-256", () => {
    expect(canonicalSerialize({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"y":2},"z":1}',
    );

    const result = simulateMatch(fixtureMatchInput(999n));
    const expected = createHash("sha256")
      .update(canonicalSerialize(result))
      .digest("hex");

    expect(hashMatchResult(result)).toBe(expected);
  });
});
