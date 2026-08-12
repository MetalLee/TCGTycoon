import { Link } from "react-router";
import type { DeckDetailView } from "../../selectors/meta";
import { formatMetaConfidence } from "../../selectors/meta";

export type DeckDetailProps = { view: DeckDetailView };

export function DeckDetail({ view }: DeckDetailProps) {
  return (
    <article className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {view.deck.factionId} · Generation {view.deck.generation}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{view.name}</h2>
        {view.stats === null ? (
          <p className="mt-2 text-sm text-slate-400">No observed matches.</p>
        ) : (
          <p className="mt-2 text-sm text-slate-300">
            {(view.stats.usageRate * 100).toFixed(1)}% usage ·{" "}
            {(view.stats.observedWinRate * 100).toFixed(1)}% observed win rate ·{" "}
            {view.stats.sampleCount} samples ·{" "}
            {formatMetaConfidence(view.stats.confidence)}
          </p>
        )}
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="font-semibold">Card list</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {view.cards.map((card) => (
            <li
              key={card.cardId}
              className="flex justify-between rounded border border-slate-800 p-2 text-sm"
            >
              <Link className="text-emerald-300" to={`/cards/${card.cardId}`}>
                {card.name}
              </Link>
              <span className="text-slate-400">×{card.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="font-semibold">Replay evidence</h3>
        <Link className="mt-3 inline-block text-emerald-300" to="/tournaments">
          Open official tournaments and persisted match replays
        </Link>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="font-semibold">Observed matchups</h3>
        {view.matchups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No matchup samples.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {view.matchups.map((matchup) => (
              <li
                key={matchup.opponentDeckId}
                className="rounded border border-slate-800 p-3"
              >
                <Link
                  className="text-emerald-300"
                  to={`/meta/decks/${matchup.opponentDeckId}`}
                >
                  {matchup.opponentName}
                </Link>
                <span className="ml-2 text-slate-300">
                  {(matchup.observedWinRate * 100).toFixed(1)}% ·{" "}
                  {matchup.sampleCount} samples ·{" "}
                  {formatMetaConfidence(matchup.confidence)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
