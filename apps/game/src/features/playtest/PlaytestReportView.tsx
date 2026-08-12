import { useState } from "react";
import type { CardDefinition } from "../../../../../packages/domain/src/index";
import type { PlaytestReport } from "../../../../../packages/sim-core/src/index";
import { Link } from "react-router";
import { EstimateValue } from "../../components/semantics/EstimateValue";

const tabs = [
  "OVERVIEW",
  "DECKS",
  "CARDS",
  "MATCHUPS",
  "ANOMALIES",
  "REPLAYS",
] as const;
type PlaytestReportTab = (typeof tabs)[number];

export type PlaytestReportViewProps = {
  report: Readonly<PlaytestReport>;
  cards?: Readonly<Record<string, Readonly<CardDefinition>>>;
};

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function PlaytestReportView({
  report,
  cards = {},
}: PlaytestReportViewProps) {
  const [tab, setTab] = useState<PlaytestReportTab>("OVERVIEW");
  return (
    <article className="space-y-6">
      <header>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider">
          <span className="text-emerald-400">{report.tier} Playtest</span>
          <span
            className={
              report.status === "FRESH" ? "text-sky-300" : "text-amber-300"
            }
          >
            {report.status} evidence
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Playtest Report</h2>
        {report.status === "STALE" && (
          <p className="mt-2 rounded border border-amber-900 bg-amber-950/20 p-3 text-sm text-amber-200">
            Gameplay revisions changed after this run. Treat these observations
            as stale and queue another Playtest before relying on them.
          </p>
        )}
      </header>

      <div role="tablist" aria-label="Playtest report">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`mr-2 rounded px-3 py-2 text-sm ${
              tab === item
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-slate-400"
            }`}
          >
            {item.slice(0, 1) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {tab === "OVERVIEW" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Matches", report.matchesRun.toLocaleString("en-US")],
            ["Candidate decks", report.candidatesEvaluated],
            ["First-player win rate", percent(report.firstPlayerWinRate)],
            ["Average turns", report.averageTurns.toFixed(1)],
            ["Diversity estimate", percent(report.diversityEstimate)],
            ["High-risk cards", report.highRiskCards.length],
            ["Combo candidates", report.comboCandidates.length],
            ["Safety warnings", report.triggerSafetyWarnings.length],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {label}
              </p>
              {String(label).includes("estimate") ? (
                <EstimateValue
                  label={String(label)}
                  value={value}
                  basis={`${report.matchesRun} deterministic simulated matches`}
                />
              ) : (
                <p className="mt-2 text-xl font-semibold">{value}</p>
              )}
            </div>
          ))}
          {report.comboCandidates.length === 0 && (
            <p className="md:col-span-2 xl:col-span-4 rounded border border-slate-800 p-4 text-sm text-slate-300">
              No critical combo was discovered within this Playtest’s finite
              search budget.
            </p>
          )}
          {report.comboCandidates.length > 0 && (
            <div className="space-y-2 rounded border border-amber-900 bg-amber-950/20 p-4 text-sm md:col-span-2 xl:col-span-4">
              <h3 className="font-semibold text-amber-200">
                Discovered combo candidates
              </h3>
              <ul className="space-y-1 text-amber-100">
                {report.comboCandidates.map((combo) => (
                  <li key={combo.cardIds.join(":")}>
                    {combo.cardIds.join(" + ")} · {combo.activations} observed
                    activations · {percent(combo.observedWinRate)} wins after
                    activation
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.triggerSafetyWarnings.length > 0 && (
            <div className="space-y-2 rounded border border-red-900 bg-red-950/20 p-4 text-sm md:col-span-2 xl:col-span-4">
              <h3 className="font-semibold text-red-200">
                Trigger-safety evidence
              </h3>
              <ul className="space-y-1 text-red-100">
                {report.triggerSafetyWarnings.map((warning) => (
                  <li key={`${warning.code}:${warning.limit}`}>
                    {warning.code} ({warning.limit}) · {warning.occurrences}{" "}
                    observed occurrence
                    {warning.occurrences === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      {tab === "DECKS" && (
        <section className="space-y-3">
          {report.candidateDeckStats.map((deck) => (
            <article
              key={deck.deckId}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
            >
              <h3 className="font-semibold">{deck.deckId}</h3>
              <p className="mt-2 text-sm text-slate-400">
                {deck.matches} observed matches ·{" "}
                {percent(deck.observedWinRate)} observed win rate
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {deck.cards
                  .map((entry) => `${entry.cardId} ×${entry.count}`)
                  .join(", ")}
              </p>
            </article>
          ))}
        </section>
      )}
      {tab === "CARDS" && (
        <section>
          {report.highRiskCards.length === 0 ? (
            <p className="rounded border border-slate-800 p-4 text-sm text-slate-300">
              No high-risk card was discovered at the configured evidence
              threshold.
            </p>
          ) : (
            <ul className="space-y-3">
              {report.highRiskCards.map((card) => (
                <li
                  key={card.cardId}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
                >
                  <Link
                    to={`/cards/${card.cardId}`}
                    className="font-semibold text-emerald-300"
                  >
                    {cards[card.cardId]?.name ?? card.cardId}
                  </Link>
                  <p className="mt-2 text-sm text-slate-400">
                    {card.observedMatches} observations ·{" "}
                    {percent(card.observedWinRate)} observed win rate
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === "MATCHUPS" && (
        <section className="rounded border border-slate-800 p-4 text-sm text-slate-300">
          Matchup evidence was not emitted by this Playtest report. Run output
          is limited to the evidence fields captured by its configured search.
        </section>
      )}
      {tab === "ANOMALIES" && (
        <section>
          {report.anomalies.length === 0 ? (
            <p className="rounded border border-slate-800 p-4 text-sm text-slate-300">
              No replay-worthy anomaly was discovered in this run.
            </p>
          ) : (
            <ul className="space-y-3">
              {report.anomalies.map((anomaly) => (
                <li
                  key={anomaly.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
                >
                  <p className="font-semibold">{anomaly.type}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {anomaly.reason}
                  </p>
                  <Link
                    to={`/matches/${anomaly.id}`}
                    className="mt-3 inline-block text-sm text-emerald-300"
                  >
                    Inspect replay evidence →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === "REPLAYS" && (
        <section>
          {report.anomalyReplayReferences.length === 0 ? (
            <p className="rounded border border-slate-800 p-4 text-sm text-slate-300">
              No anomaly replay was captured because no replay-worthy anomaly
              was discovered.
            </p>
          ) : (
            <ul className="space-y-2">
              {report.anomalyReplayReferences.map((reference) => (
                <li key={reference}>
                  <Link
                    to={`/matches/${reference}`}
                    className="text-emerald-300"
                  >
                    {reference}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
