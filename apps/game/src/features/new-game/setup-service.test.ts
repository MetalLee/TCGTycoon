import {
  validateCardDefinition,
  validateDeck,
} from "../../../../../packages/rules-engine/src/index";
import { describe, expect, it } from "vitest";
import { createOfflineLaunch } from "./setup-service";

describe("offline Launch Setup service", () => {
  it("creates the approved deterministic Launch content and enters live Day 1", () => {
    const first = createOfflineLaunch({
      seed: "offline-launch",
      gameName: "Aether Circuit",
      setting: "Four leagues compete through living machines.",
      visualKeywords: ["arcane", "industrial"],
      boosterPrintQuantity: 1_000,
      starterPrintQuantity: 250,
    });
    const second = createOfflineLaunch({
      seed: "offline-launch",
      gameName: "Aether Circuit",
      setting: "Four leagues compete through living machines.",
      visualKeywords: ["arcane", "industrial"],
      boosterPrintQuantity: 1_000,
      starterPrintQuantity: 250,
    });

    expect(second).toEqual(first);
    expect(first.factions).toHaveLength(4);
    expect(Object.values(first.world.cards)).toHaveLength(48);
    expect(
      Object.values(first.world.cards).every(
        (card) => validateCardDefinition(card).valid,
      ),
    ).toBe(true);
    expect(first.starterDecks).toHaveLength(4);
    expect(
      first.starterDecks.every(
        (deck) =>
          deck.cards.reduce((total, entry) => total + entry.count, 0) === 20 &&
          validateDeck(deck, Object.values(first.world.cards)).valid,
      ),
    ).toBe(true);
    expect(Object.values(first.world.products)).toHaveLength(5);
    expect(Object.values(first.world.printRuns)).toHaveLength(5);
    expect(
      Object.values(first.world.printRuns).every(
        (run) => run.status === "COMPLETED" && run.quantity > 0,
      ),
    ).toBe(true);
    expect(
      Object.values(first.world.products).every(
        (product) => product.releaseStatus === "LIVE",
      ),
    ).toBe(true);
    expect(first.world.status).toBe("LIVE");
    expect(first.world.day).toBe(1);
  });
});
