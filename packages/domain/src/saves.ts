import type { SaveId } from "./ids";
import type { WorldState } from "./world";

export type SaveEnvelope = {
  saveId: SaveId;
  schemaVersion: number;
  simulationVersion: string;
  ruleVersion: string;
  balanceVersion: string;
  appVersion: string;
  worldSeed: string;
  createdAt: string;
  updatedAt: string;
  state: WorldState;
};
export type SaveMetadata = Omit<SaveEnvelope, "state">;
