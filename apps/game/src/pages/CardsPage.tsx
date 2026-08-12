import { useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { CardDatabase } from "../features/cards/CardDatabase";

export function CardsPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  return (
    <section className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Designer and live ecosystem
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Cards</h1>
      </header>
      {snapshot.world === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          Load or create a save to inspect cards.
        </p>
      ) : (
        <CardDatabase world={snapshot.world} />
      )}
    </section>
  );
}
