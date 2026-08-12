import { Link } from "react-router";
import type { MetaOverviewView } from "../../selectors/meta";
import { formatMetaConfidence } from "../../selectors/meta";

export type MetaOverviewProps = { view: MetaOverviewView };

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function MetaOverview({ view }: MetaOverviewProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Meta Health
        </p>
        <p className="mt-2 text-3xl font-semibold text-emerald-300">
          {view.metaHealth.toFixed(0)}
        </p>
        <ul
          aria-label="Meta Health contributors"
          className="mt-4 grid gap-3 lg:grid-cols-5"
        >
          {view.contributors.map((contributor) => (
            <li
              key={contributor.key}
              data-testid={`meta-health-${contributor.label.toLowerCase().replaceAll(" ", "-")}`}
              className="rounded border border-slate-800 bg-slate-950/60 p-3"
            >
              <p className="font-medium text-slate-100">{contributor.label}</p>
              <p className="mt-1 text-sm text-slate-300">
                Score: {percent(contributor.score)}
              </p>
              <p className="text-xs text-slate-400">
                Measured contribution:{" "}
                {percent(contributor.measuredContribution)}
              </p>
              <p className="sr-only">{contributor.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Observed decks</h2>
        {view.decks.length === 0 ? (
          <p className="mt-3 rounded border border-slate-800 p-4 text-slate-400">
            No observed deck samples yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {view.decks.map((deck) => (
              <article
                key={deck.id}
                data-testid={`meta-deck-${deck.id}`}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      className="font-semibold text-emerald-300 hover:text-emerald-200"
                      to={`/meta/decks/${deck.id}`}
                    >
                      {deck.name}
                    </Link>
                    <p className="text-sm text-slate-400">{deck.factionId}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      {percent(deck.usageRate)} usage ·{" "}
                      {percent(deck.observedWinRate)} win rate
                    </p>
                    <p className="text-slate-400">
                      {deck.sampleCount} observed matches
                    </p>
                    <p className="text-amber-300 capitalize">
                      {formatMetaConfidence(deck.confidence)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
