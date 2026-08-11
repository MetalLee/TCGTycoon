import { describe, expect, it } from "vitest";
import { MemorySaveRepository } from "../index";
import { saveId, type SaveEnvelope } from "@tcgtycoon/domain";

const createSave = (): SaveEnvelope => ({
  saveId: saveId("save-launch"),
  schemaVersion: 1,
  simulationVersion: "1",
  ruleVersion: "1",
  balanceVersion: "1",
  appVersion: "0.1.0",
  worldSeed: "launch-seed",
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  state: { schemaVersion: 1, day: 0 } as SaveEnvelope["state"],
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
});
