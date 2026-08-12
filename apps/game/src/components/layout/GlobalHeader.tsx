import type {
  DeepReadonly,
  GameSessionStatus,
} from "../../app/game-session/GameSessionController";
import type { WorldState } from "../../../../../packages/domain/src/index";
import { FactValue } from "../semantics/FactValue";

export type GlobalHeaderProps = {
  world: DeepReadonly<WorldState> | null;
  sessionStatus: GameSessionStatus;
  onEndDay: () => void;
};

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const cashFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function metric(value: number | undefined): string {
  return value === undefined ? "—" : integerFormatter.format(value);
}

export function GlobalHeader({
  world,
  sessionStatus,
  onEndDay,
}: GlobalHeaderProps) {
  const canEndDay = world !== null && sessionStatus === "IDLE";
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5">
          <FactValue
            compact
            label="Players"
            value={metric(world?.metrics.activePlayers)}
          />
          <FactValue compact label="Hype" value={metric(world?.metrics.hype)} />
          <FactValue
            compact
            label="Meta"
            value={metric(world?.metrics.metaHealth)}
          />
          <FactValue
            compact
            label="Trust"
            value={metric(world?.metrics.brandTrust)}
          />
          <FactValue
            compact
            label="Cash"
            value={
              world === null ? "—" : cashFormatter.format(world.cash.balance)
            }
          />
          <FactValue compact label="Day" value={metric(world?.day)} />
        </div>
        <button
          type="button"
          disabled={!canEndDay}
          onClick={onEndDay}
          className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {sessionStatus === "SIMULATING"
            ? "Simulating…"
            : sessionStatus === "SAVING"
              ? "Saving…"
              : "End Day"}
        </button>
      </div>
    </header>
  );
}
