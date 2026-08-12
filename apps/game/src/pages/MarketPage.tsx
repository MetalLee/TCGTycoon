import { useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { MarketOverview } from "../features/market/MarketOverview";
import { selectMarketOverview } from "../selectors/market";

export function MarketPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Market</h1>
        <p className="mt-2 text-slate-400">
          Publisher product sales and observation-only secondary printing
          markets.
        </p>
      </header>
      {snapshot.world === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          Load a save to inspect markets.
        </p>
      ) : (
        <MarketOverview view={selectMarketOverview(snapshot.world as never)} />
      )}
    </section>
  );
}
