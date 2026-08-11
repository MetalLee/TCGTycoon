import { describe, expect, it } from "vitest";
import { createInitialPopulation } from "./create-population";

describe("createInitialPopulation", () => {
  it("creates the standard deterministic population", () => {
    const population = createInitialPopulation("seed-a");

    expect(Object.keys(population.players)).toHaveLength(400);
    expect(Object.keys(population.agents)).toHaveLength(24);
    expect(population).toEqual(createInitialPopulation("seed-a"));
    expect(population).not.toEqual(createInitialPopulation("seed-b"));

    for (const agent of Object.values(population.agents)) {
      expect(population.players[agent.playerId]).toBeDefined();
      expect(agent.role).not.toBe("");
      expect(agent.influence).toBeGreaterThanOrEqual(0);
      expect(agent.influence).toBeLessThanOrEqual(1);
      expect(agent.followers).toBeGreaterThanOrEqual(0);
      expect(agent.brandAttitude).toBeGreaterThanOrEqual(-1);
      expect(agent.brandAttitude).toBeLessThanOrEqual(1);
      expect(agent.recentMemories).toEqual([]);
      expect(agent.longTermSummary).toBe("");
      expect(agent).not.toHaveProperty("llm");
    }
  });

  it("creates bounded motivation vectors without initial card ownership", () => {
    const { players } = createInitialPopulation("seed-a");

    for (const player of Object.values(players)) {
      expect(Object.values(player.motivation)).toHaveLength(6);
      for (const motivation of Object.values(player.motivation)) {
        expect(motivation).toBeGreaterThanOrEqual(0);
        expect(motivation).toBeLessThanOrEqual(1);
      }

      expect(player.collection).toEqual({});
      expect(player.deckIds).toEqual([]);
      expect(player.knowledge).toEqual({ knownCardIds: [], knownDeckIds: [] });
    }
  });
});
