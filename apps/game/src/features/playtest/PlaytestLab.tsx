import { PLAYTEST_CONFIG } from "../../../../../packages/balance/src/index";
import type {
  ExpansionId,
  PlaytestTier,
  PublisherCommand,
} from "../../../../../packages/domain/src/index";

const tiers = ["QUICK", "STANDARD", "DEEP"] as const;

function tierConfig(tier: PlaytestTier) {
  switch (tier) {
    case "QUICK":
      return PLAYTEST_CONFIG.quick;
    case "STANDARD":
      return PLAYTEST_CONFIG.standard;
    case "DEEP":
      return PLAYTEST_CONFIG.deep;
  }
}

export type PlaytestLabProps = {
  expansionId: ExpansionId;
  expansionName: string;
  queueCommand: (command: PublisherCommand) => void;
  disabled?: boolean;
};

export function PlaytestLab({
  expansionId,
  expansionName,
  queueCommand,
  disabled = false,
}: PlaytestLabProps) {
  return (
    <section className="space-y-4" aria-labelledby="playtest-lab-title">
      <div>
        <h2 id="playtest-lab-title" className="text-xl font-semibold">
          Playtest Lab
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose the finite search budget for {expansionName}. Reports contain
          discovered evidence only.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => {
          const config = tierConfig(tier);
          return (
            <article
              key={tier}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                {tier}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-400">Duration</dt>
                <dd>{config.durationDays} live days</dd>
                <dt className="text-slate-400">Match budget</dt>
                <dd>{config.matchBudget.toLocaleString("en-US")}</dd>
                <dt className="text-slate-400">Candidate decks</dt>
                <dd>{config.candidateDeckBudget}</dd>
                <dt className="text-slate-400">Cost</dt>
                <dd>${config.cashCost.toLocaleString("en-US")}</dd>
              </dl>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  queueCommand({ type: "START_PLAYTEST", expansionId, tier })
                }
                className="mt-4 w-full rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                Queue {tier.slice(0, 1) + tier.slice(1).toLowerCase()} Playtest
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
