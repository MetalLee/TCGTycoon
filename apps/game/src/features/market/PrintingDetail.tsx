import { Link } from "react-router";
import type { PrintingMarketView } from "../../selectors/market";

export type PrintingDetailProps = { view: PrintingMarketView };

export function PrintingDetail({ view }: PrintingDetailProps) {
  return (
    <article className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-400">
          Secondary market · {view.edition}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{view.cardName}</h2>
        <div className="mt-2 flex gap-4 text-sm">
          <Link className="text-emerald-300" to={`/cards/${view.cardId}`}>
            Card detail
          </Link>
          <Link className="text-emerald-300" to={`/products/${view.productId}`}>
            Source product
          </Link>
        </div>
      </header>
      <dl className="grid gap-3 sm:grid-cols-4">
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Last price</dt>
          <dd>
            {view.lastPrice === null ? "—" : `$${view.lastPrice.toFixed(2)}`}
          </dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Daily volume</dt>
          <dd>{view.dailyVolume}</dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Available supply</dt>
          <dd>{view.availableSupply}</dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Liquidity</dt>
          <dd>{(view.liquidity * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <section className="rounded border border-slate-800 p-4">
        <h3 className="font-semibold">Price history</h3>
        {view.priceHistory.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            No clearing-price history yet.
          </p>
        ) : (
          <ol className="mt-3 space-y-1 text-sm">
            {view.priceHistory.map((entry) => (
              <li key={entry.day}>
                Day {entry.day}: ${entry.price.toFixed(2)} · {entry.volume}{" "}
                volume
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="text-sm text-slate-400">
        The publisher observes this market and cannot buy or sell individual
        cards.
      </p>
    </article>
  );
}
