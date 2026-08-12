import "fake-indexeddb/auto";
import { saveId, type SaveEnvelope } from "@tcgtycoon/domain";
import { afterEach, describe, expect, it } from "vitest";
import { TcgTycoonDexie } from "./dexie-db";
import { DexieSaveRepository } from "./dexie-save-repository";

const databases: TcgTycoonDexie[] = [];

function createRepository(name: string): DexieSaveRepository {
  const database = new TcgTycoonDexie(name);
  databases.push(database);
  return new DexieSaveRepository(database);
}

function createSave(id: string, day: number): SaveEnvelope {
  return {
    saveId: saveId(id),
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    appVersion: "test",
    worldSeed: `seed-${id}`,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: `2026-08-12T${String(day).padStart(2, "0")}:00:00.000Z`,
    state: {
      schemaVersion: 5,
      simulationVersion: "1",
      ruleVersion: "1",
      balanceVersion: "1",
      worldSeed: `seed-${id}`,
      day,
      status: "LIVE",
      cards: {},
      printings: {},
      expansions: {},
      products: {},
      printRuns: {},
      players: {},
      agents: {},
      decks: {},
      cohorts: [],
      market: { listings: [], snapshots: {} },
      meta: { deckStats: {}, matchups: {} },
      metrics: {
        activePlayers: 0,
        previousActivePlayers: 0,
        hype: 0,
        collectorHeat: 0,
        metaHealth: 0,
        accessibility: 0,
        brandTrust: 0,
        sentiment: 0,
        lifecycle: {
          potential: 0,
          interested: 0,
          newByAge: [0, 0, 0, 0, 0, 0, 0],
          active: 0,
          atRisk: 0,
          churned: 0,
          returning: 0,
        },
        ecosystemRisk: "STABLE",
        lifecycleDeltas: {
          potentialToInterested: 0,
          interestedToNew: 0,
          newToActive: 0,
          activeToAtRisk: 0,
          atRiskToChurned: 0,
          churnedToReturning: 0,
          returningToActive: 0,
        },
        acquisitionToChurnRatio: 1,
        retentionRate: 1,
        activePlayerTrend: 0,
        consecutiveDeclineDays: 0,
        consecutiveLowActivityDays: 0,
      },
      cash: { balance: 0, ledger: [] },
      history: { events: [] },
    },
  };
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("DexieSaveRepository", () => {
  it("lists, saves and loads canonical save envelopes as detached clones", async () => {
    const repository = createRepository("save-repository-roundtrip");
    const alpha = createSave("save-alpha", 1);
    const beta = createSave("save-beta", 2);

    await repository.save(alpha);
    await repository.save(beta);
    const listed = await repository.list();
    const loaded = await repository.load(alpha.saveId);

    expect(listed.map((metadata) => metadata.saveId)).toEqual([
      beta.saveId,
      alpha.saveId,
    ]);
    expect(loaded).toEqual(alpha);
    expect(loaded).not.toBe(alpha);
    expect(loaded.state).not.toBe(alpha.state);
  });

  it("rotates the prior current envelope into the previous autosave", async () => {
    const repository = createRepository("save-repository-autosave");
    const day1 = createSave("save-autosave", 1);
    const day2 = createSave("save-autosave", 2);
    const day3 = createSave("save-autosave", 3);

    await repository.save(day1);
    await repository.save(day2);
    await repository.save(day3);

    expect((await repository.load(day3.saveId)).state.day).toBe(3);
    expect((await repository.loadPrevious(day3.saveId)).state.day).toBe(2);
  });

  it("deletes both current and previous snapshots for a save slot", async () => {
    const repository = createRepository("save-repository-delete");
    const day1 = createSave("save-delete", 1);
    const day2 = createSave("save-delete", 2);
    await repository.save(day1);
    await repository.save(day2);

    await repository.delete(day2.saveId);

    await expect(repository.load(day2.saveId)).rejects.toThrow(
      "Save not found",
    );
    await expect(repository.loadPrevious(day2.saveId)).rejects.toThrow(
      "Previous autosave not found",
    );
    expect(await repository.list()).toEqual([]);
  });

  it("rejects UI-shaped or corrupt values at the canonical save boundary", async () => {
    const repository = createRepository("save-repository-validation");
    const save = createSave("save-invalid", 1);

    await expect(
      repository.save({
        ...save,
        state: null,
        sidebarCollapsed: true,
      } as never),
    ).rejects.toThrow();
  });
});
