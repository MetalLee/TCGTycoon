import { saveId, type SaveEnvelope } from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { MemorySaveRepository, migrateSave } from "../index";

const createSave = (): SaveEnvelope =>
  migrateSave({
    saveId: saveId("save-launch"),
    schemaVersion: 1,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    appVersion: "0.1.0",
    worldSeed: "launch-seed",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    state: {
      schemaVersion: 1,
      simulationVersion: "1",
      ruleVersion: "1",
      balanceVersion: "1",
      worldSeed: "launch-seed",
      day: 0,
      status: "SETUP",
      cards: {},
      printings: {},
      expansions: {},
      products: {},
      printRuns: {},
      players: {},
      agents: {},
      decks: {},
      cohorts: [],
      market: { listings: [] },
      meta: { deckStats: {} },
      metrics: { activePlayers: 0 },
      cash: { balance: 0, ledger: [] },
      history: { events: [] },
    },
  });

describe("MemorySaveRepository", () => {
  it("loads a deep-equal clone instead of the saved object reference", async () => {
    const repository = new MemorySaveRepository();
    const save = createSave();

    await repository.save(save);
    const loaded = await repository.load(saveId("save-launch"));

    expect(loaded).toEqual(save);
    expect(loaded).not.toBe(save);
    expect(loaded.state).not.toBe(save.state);
  });

  it("rejects corrupt state at the save boundary", async () => {
    const repository = new MemorySaveRepository();
    const save = createSave();

    await expect(
      repository.save({ ...save, state: null } as never),
    ).rejects.toThrow();
  });
});
