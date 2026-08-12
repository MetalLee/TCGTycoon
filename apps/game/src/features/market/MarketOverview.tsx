import { useState } from "react";
import { Link } from "react-router";
import type { MarketOverviewView } from "../../selectors/market";

export type MarketOverviewProps = { view: MarketOverviewView };

export function MarketOverview({ view }: MarketOverviewProps) {
  const [market, setMarket] = useState<"PRIMARY" | "SECONDARY">("PRIMARY");
  return (
    <section className="space-y-5">
      <div role="tablist" aria-label="Market type" className="flex gap-2">
        {(["PRIMARY", "SECONDARY"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={market === tab}
            onClick={() => setMarket(tab)}
            className={`rounded px-4 py-2 ${market === tab ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400"}`}
          >
            {tab === "PRIMARY" ? "Primary products" : "Secondary printings"}
          </button>
        ))}
      </div>
      {market === "PRIMARY" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {view.products.map((product) => (
            <article
              key={product.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {product.kind} · {product.status}
              </p>
              <Link
                className="mt-2 block text-lg font-semibold text-emerald-300"
                to={`/products/${product.id}`}
              >
                {product.name}
              </Link>
              <p className="mt-3 text-sm">
                Inventory {product.inventory} · Sales revenue $
                {product.salesRevenue.toFixed(2)} · Pack EV $
                {product.packExpectedValue.toFixed(2)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {view.printings.map((printing) => (
            <article
              key={printing.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {printing.edition}
              </p>
              <Link
                className="mt-2 block font-semibold text-emerald-300"
                to={`/printings/${printing.id}`}
              >
                {printing.cardName}
              </Link>
              <p className="mt-3 text-sm">
                Price{" "}
                {printing.lastPrice === null
                  ? "—"
                  : `$${printing.lastPrice.toFixed(2)}`}{" "}
                · Volume {printing.dailyVolume} · Supply{" "}
                {printing.availableSupply}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
