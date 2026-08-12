import { useState } from "react";
import type { CardDetailView } from "../../selectors/cards";
import { Link } from "react-router";

const tabs = ["OVERVIEW", "PERFORMANCE", "MARKET", "HISTORY"] as const;
type CardDetailTab = (typeof tabs)[number];

export type CardDetailProps = {
  view: CardDetailView;
};

export function CardDetail({ view }: CardDetailProps) {
  const [tab, setTab] = useState<CardDetailTab>("OVERVIEW");
  return (
    <article className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {view.card.factionId} · {view.card.rarity} · {view.listItem.legality}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{view.card.name}</h2>
      </header>
      <div role="tablist" aria-label="Card detail">
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
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="font-semibold">Designer definition</h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-400">Type</dt>
              <dd>{view.card.type}</dd>
              <dt className="text-slate-400">Cost</dt>
              <dd>{view.card.cost}</dd>
              {view.card.type === "UNIT" && (
                <>
                  <dt className="text-slate-400">Stats</dt>
                  <dd>
                    {view.card.attack}/{view.card.health}
                  </dd>
                </>
              )}
              <dt className="text-slate-400">Keywords</dt>
              <dd>{view.card.keywords.join(", ") || "None"}</dd>
            </dl>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="font-semibold">Known Synergies</h3>
            {view.knownSynergies.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                No synergy has been publicly discovered yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {view.knownSynergies.map((synergy) => (
                  <li key={synergy.cardId}>
                    {synergy.name} · {synergy.publicDeckCount} public deck
                    {synergy.publicDeckCount === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      {tab === "PERFORMANCE" && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-semibold">Observed performance</h3>
          <p className="mt-3 text-sm">
            Seen in {view.observedDeckCount} canonical deck
            {view.observedDeckCount === 1 ? "" : "s"}; current aggregate usage{" "}
            {(view.listItem.usageRate * 100).toFixed(1)}%.
          </p>
        </section>
      )}
      {tab === "MARKET" && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-semibold">Observed secondary market</h3>
          <p className="mt-3 text-sm">
            Price {view.listItem.market.lastPrice?.toFixed(2) ?? "not observed"}
            {" · "}Daily volume {view.listItem.market.dailyVolume}
            {" · "}Supply {view.listItem.market.availableSupply}
          </p>
          {view.tournamentDemand !== null && (
            <p className="mt-3 rounded border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">
              Recent tournament demand signal: deck{" "}
              {view.tournamentDemand.deckId}
              {" · "}prestige{" "}
              {Math.round(view.tournamentDemand.tournamentPrestige * 100)}%
              {" · "}Day {view.tournamentDemand.day}
            </p>
          )}
          <Link className="mt-3 inline-block text-emerald-300" to="/market">
            Open Market and related products
          </Link>
        </section>
      )}
      {tab === "HISTORY" && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-semibold">Structured history</h3>
          {view.history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              No card event recorded.
            </p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {view.history.map((event) => (
                <li key={event.id}>
                  Day {event.day}: {event.type}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </article>
  );
}
