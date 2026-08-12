import {
  METRICS_CONFIG,
  RELEASE_CONFIG,
} from "../../../../../packages/balance/src/index";
import type {
  OperationProject,
  ProductReleaseStatus,
} from "../../../../../packages/domain/src/index";
import type { GameSessionStatus } from "../../app/game-session/GameSessionController";

export type EndDayWorld = Readonly<{
  day: number;
  metrics: Readonly<{ metaHealth: number }>;
  products: Readonly<
    Record<
      string,
      Readonly<{
        id: string;
        name: string;
        releaseStatus: ProductReleaseStatus;
      }>
    >
  >;
  printRuns: Readonly<
    Record<
      string,
      Readonly<{
        productId: string;
        quantity: number;
        status: "PRINTING" | "COMPLETED";
      }>
    >
  >;
  operations?: Readonly<Record<string, Readonly<OperationProject>>>;
}>;

export type EndDayWarning = Readonly<{
  id: string;
  message: string;
}>;

export type EndDayDialogProps = {
  world: EndDayWorld;
  sessionStatus: GameSessionStatus;
  pendingCommandCount: number;
  onProceed: () => void | Promise<void>;
  onCancel?: () => void;
};

function inventoryForProduct(world: EndDayWorld, productId: string): number {
  return Object.values(world.printRuns).reduce(
    (total, run) =>
      run.productId === productId && run.status === "COMPLETED"
        ? total + run.quantity
        : total,
    0,
  );
}

export function selectEndDayWarnings(world: EndDayWorld): EndDayWarning[] {
  const warnings: EndDayWarning[] = [];
  for (const product of Object.values(world.products).sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  )) {
    if (
      product.releaseStatus === "LIVE" &&
      inventoryForProduct(world, product.id) <
        RELEASE_CONFIG.shortSupplyThreshold
    ) {
      warnings.push({
        id: `low-stock:${product.id}`,
        message: `${product.name} is out of stock or in critically low supply.`,
      });
    }
  }

  const neutralMetaHealth =
    METRICS_CONFIG.metaHealth.insufficientSampleNeutralScore * 100;
  const criticalMetaHealth = neutralMetaHealth / 2;
  if (world.metrics.metaHealth < criticalMetaHealth) {
    warnings.push({
      id: "critical-meta",
      message: `Meta Health is critical at ${Math.round(world.metrics.metaHealth)}.`,
    });
  }

  const operations = Object.values(world.operations ?? {}).sort(
    (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
  for (const operation of operations) {
    if (
      operation.type === "PLAYTEST" &&
      operation.status === "COMPLETED" &&
      operation.completionDay === world.day
    ) {
      warnings.push({
        id: `completed-playtest:${operation.id}`,
        message: `${operation.payload.tier[0]}${operation.payload.tier
          .slice(1)
          .toLowerCase()} Playtest completed today and is ready for review.`,
      });
    }
    if (
      operation.type === "TOURNAMENT" &&
      operation.status === "PLANNED" &&
      operation.startDay === world.day + 1
    ) {
      warnings.push({
        id: `near-tournament:${operation.id}`,
        message: `${operation.payload.tournamentId} starts tomorrow.`,
      });
    }
  }
  return warnings;
}

export function EndDayDialog({
  world,
  sessionStatus,
  pendingCommandCount,
  onProceed,
  onCancel,
}: EndDayDialogProps) {
  const warnings = selectEndDayWarnings(world);
  const simulationRunning = sessionStatus === "SIMULATING";
  const saveRunning = sessionStatus === "SAVING";

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-day-title"
      className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Day {world.day}
      </p>
      <h2 id="end-day-title" className="mt-2 text-2xl font-semibold">
        End Day Review
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        {pendingCommandCount === 1
          ? "1 queued publisher action will be committed."
          : `${pendingCommandCount} queued publisher actions will be committed.`}
      </p>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-200">
          Items worth reviewing
        </h3>
        {warnings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            No unresolved warnings were detected.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {warnings.map((warning) => (
              <li
                key={warning.id}
                className="rounded border border-amber-900/70 bg-amber-950/20 p-3 text-sm text-amber-100"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(simulationRunning || saveRunning) && (
        <p className="mt-6 text-sm text-emerald-300">
          {sessionStatus === "SIMULATING"
            ? "Simulation is running."
            : "The completed day is being saved."}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        {onCancel !== undefined && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-600 px-4 py-2 text-slate-200"
          >
            Keep Planning
          </button>
        )}
        {!simulationRunning && (
          <button
            type="button"
            disabled={saveRunning}
            onClick={() => void onProceed()}
            className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Proceed Anyway
          </button>
        )}
      </div>
    </section>
  );
}
