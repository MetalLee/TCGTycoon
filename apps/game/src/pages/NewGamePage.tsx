import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import {
  saveId,
  type SaveEnvelope,
} from "../../../../packages/domain/src/index";
import { CURRENT_SCHEMA_VERSION } from "../../../../packages/persistence/src/index";
import { NewGameWizard } from "../features/new-game/NewGameWizard";
import type {
  OfflineLaunchInput,
  OfflineLaunchResult,
} from "../features/new-game/setup-service";
import { SaveSlotList } from "../features/saves/SaveSlotList";
import type { GameSessionOutlet } from "../components/layout/AppShell";

export function NewGamePage() {
  const navigate = useNavigate();
  const session = useOutletContext<GameSessionOutlet>();
  const repository = session.saveRepository;
  const [refreshToken, setRefreshToken] = useState(0);
  const [createdSlot, setCreatedSlot] = useState<string | null>(null);

  async function saveLaunch(
    result: OfflineLaunchResult,
    input: OfflineLaunchInput,
  ): Promise<void> {
    if (repository === undefined)
      throw new Error("Save repository unavailable");
    const timestamp = new Date().toISOString();
    const slotId = saveId(`save-${input.seed}`);
    const state = {
      ...result.world,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      operations: result.world.operations ?? {},
      expansionProjects: result.world.expansionProjects ?? {},
      operationEvidence: result.world.operationEvidence ?? {
        playtests: { runs: {}, reports: {} },
        tournamentAttention: [],
      },
      announcementState: result.world.announcementState ?? {
        announcements: [],
      },
      dailyReports: result.world.dailyReports ?? {},
    };
    const envelope: SaveEnvelope = {
      saveId: slotId,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      simulationVersion: state.simulationVersion,
      ruleVersion: state.ruleVersion,
      balanceVersion: state.balanceVersion,
      appVersion: "0.1.0",
      worldSeed: state.worldSeed,
      createdAt: timestamp,
      updatedAt: timestamp,
      state,
    };
    await repository.save(envelope);
    await session.loadSave?.(slotId);
    setCreatedSlot(slotId);
    setRefreshToken((current) => current + 1);
    navigate("/dashboard");
  }

  async function loadSlot(slotId: SaveEnvelope["saveId"]): Promise<void> {
    await session.loadSave?.(slotId);
    navigate("/dashboard");
  }

  return (
    <section className="space-y-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Setup Phase
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">New Game</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Build the deterministic 48-card Launch Set, choose physical
          production, and enter public Day 1. Setup does not advance the live
          economy.
        </p>
      </header>
      {createdSlot !== null && (
        <p className="rounded border border-emerald-800 bg-emerald-950/30 p-3 text-emerald-200">
          Launched and saved to {createdSlot}.
        </p>
      )}
      <NewGameWizard onLaunch={saveLaunch} />
      {repository !== undefined && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Save slots</h2>
          <SaveSlotList
            repository={repository}
            refreshToken={refreshToken}
            onLoad={loadSlot}
          />
        </section>
      )}
    </section>
  );
}
