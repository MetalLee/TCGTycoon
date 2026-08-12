import { useEffect, useState } from "react";
import type { PublisherCommand } from "../../../../../packages/domain/src/index";
import type { ProductMarketView } from "../../selectors/market";

export type ProductDetailProps = {
  view: ProductMarketView;
  queueCommand?: (command: PublisherCommand) => void;
  currentDay?: number;
};

export function ProductDetail({
  view,
  queueCommand,
  currentDay,
}: ProductDetailProps) {
  const [newMsrp, setNewMsrp] = useState(view.msrp.toFixed(2));
  useEffect(() => setNewMsrp(view.msrp.toFixed(2)), [view.id, view.msrp]);
  const parsedMsrp = Number(newMsrp);
  const canQueueMsrp =
    Number.isFinite(parsedMsrp) && parsedMsrp > 0 && parsedMsrp !== view.msrp;
  return (
    <article className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider text-slate-400">
          Primary market · {view.kind} · {view.status}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{view.name}</h2>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">MSRP</dt>
          <dd>${view.msrp.toFixed(2)}</dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Inventory</dt>
          <dd>{view.inventory}</dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Sales revenue</dt>
          <dd>${view.salesRevenue.toFixed(2)}</dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Pack EV</dt>
          <dd>${view.packExpectedValue.toFixed(2)}</dd>
        </div>
      </dl>
      {queueCommand && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded border border-emerald-700 px-4 py-2 text-emerald-300"
            onClick={() =>
              queueCommand({
                type: "ORDER_PRINT_RUN",
                productId: view.id,
                quantity: 1000,
              })
            }
          >
            Queue 1,000-unit print run
          </button>
          {view.status === "UNANNOUNCED" && currentDay !== undefined && (
            <button
              type="button"
              className="rounded border border-sky-700 px-4 py-2 text-sky-300"
              onClick={() =>
                queueCommand({
                  type: "SCHEDULE_RELEASE",
                  productId: view.id,
                  releaseDay: currentDay + 10,
                })
              }
            >
              Queue release after production
            </button>
          )}
          <label className="flex items-center gap-2 text-sm">
            New MSRP
            <input
              aria-label="New MSRP"
              type="number"
              min="0.01"
              step="0.01"
              value={newMsrp}
              onChange={(event) => setNewMsrp(event.target.value)}
              className="w-28 rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
          <button
            type="button"
            disabled={!canQueueMsrp}
            className="rounded border border-slate-700 px-4 py-2 disabled:opacity-40"
            onClick={() =>
              queueCommand({
                type: "ADJUST_MSRP",
                productId: view.id,
                newMsrp: parsedMsrp,
              })
            }
          >
            Queue MSRP change
          </button>
        </div>
      )}
    </article>
  );
}
