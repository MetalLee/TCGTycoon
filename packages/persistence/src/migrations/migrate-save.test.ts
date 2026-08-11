import { describe, expect, it } from "vitest";
import { migrateSave } from "../index";

const v1Fixture = {
  saveId: "save-launch",
  schemaVersion: 1,
  simulationVersion: "1",
  ruleVersion: "1",
  balanceVersion: "1",
  appVersion: "0.1.0",
  worldSeed: "launch-seed",
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  state: { schemaVersion: 1, day: 0 },
};

describe("migrateSave", () => {
  it("returns a current v1 save envelope from a literal v1 fixture", () => {
    expect(migrateSave(v1Fixture)).toEqual(v1Fixture);
  });

  it.each([
    { ...v1Fixture, state: undefined },
    (() => {
      const saveWithoutState = { ...v1Fixture };
      Reflect.deleteProperty(saveWithoutState, "state");
      return saveWithoutState;
    })(),
  ])("rejects a v1 fixture without a defined state", (invalidSave) => {
    expect(() => migrateSave(invalidSave)).toThrow();
  });
});
