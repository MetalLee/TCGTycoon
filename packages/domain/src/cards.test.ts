import { describe, expect, it } from "vitest";
import { parseCardDefinition } from "./cards";

describe("CardDefinition DSL", () => {
  const legalSpell = {
    id: "card-machine-insight",
    name: "Machine Insight",
    type: "SPELL",
    factionId: "machine",
    rarity: "COMMON",
    cost: 2,
    keywords: [],
    triggers: [],
  };

  it("parses a legal Deathrattle unit", () => {
    const card = parseCardDefinition({
      id: "card-scrap-hound",
      name: "Scrap Hound",
      type: "UNIT",
      factionId: "machine",
      rarity: "COMMON",
      cost: 2,
      attack: 3,
      health: 2,
      keywords: ["DEATHRATTLE"],
      triggers: [
        {
          trigger: "ON_DEATH",
          conditions: [],
          effects: [{ type: "DRAW", amount: 1, target: "FRIENDLY_HERO" }],
        },
      ],
    });
    expect(card.cost).toBe(2);
  });

  it("rejects an unsupported SECRET keyword", () => {
    expect(() =>
      parseCardDefinition({
        id: "card-invalid",
        name: "Invalid",
        type: "SPELL",
        factionId: "neutral",
        rarity: "COMMON",
        cost: 1,
        keywords: ["SECRET"],
        triggers: [],
      }),
    ).toThrow();
  });

  it.each([
    ["negative cost", { ...legalSpell, cost: -1 }],
    ["fractional cost", { ...legalSpell, cost: 1.5 }],
    ["cost above the resource cap", { ...legalSpell, cost: 9 }],
    ["spell stats", { ...legalSpell, attack: 1, health: 1 }],
    [
      "more than two triggers",
      {
        ...legalSpell,
        triggers: Array.from({ length: 3 }, () => ({
          trigger: "ON_PLAY",
          conditions: [],
          effects: [],
        })),
      },
    ],
    [
      "more than three effects",
      {
        ...legalSpell,
        triggers: [
          {
            trigger: "ON_PLAY",
            conditions: [],
            effects: Array.from({ length: 4 }, () => ({
              type: "DRAW",
              amount: 1,
              target: "FRIENDLY_HERO",
            })),
          },
        ],
      },
    ],
    [
      "an unsupported effect",
      {
        ...legalSpell,
        triggers: [
          {
            trigger: "ON_PLAY",
            conditions: [],
            effects: [{ type: "FREEZE", target: "ENEMY_UNIT" }],
          },
        ],
      },
    ],
    [
      "a non-empty Core Rules v1 condition",
      {
        ...legalSpell,
        triggers: [
          {
            trigger: "ON_PLAY",
            conditions: [{ type: "HERO_HEALTH_BELOW", amount: 10 }],
            effects: [],
          },
        ],
      },
    ],
  ])("rejects %s", (_caseName, input) => {
    expect(() => parseCardDefinition(input)).toThrow();
  });

  it.each([
    ["negative attack", { attack: -1, health: 1 }],
    ["zero health", { attack: 1, health: 0 }],
    ["fractional stats", { attack: 1.5, health: 2 }],
  ])("rejects a unit with %s", (_caseName, stats) => {
    expect(() =>
      parseCardDefinition({
        ...legalSpell,
        type: "UNIT",
        ...stats,
      }),
    ).toThrow();
  });
});
