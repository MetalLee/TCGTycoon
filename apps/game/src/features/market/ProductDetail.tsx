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
          <button
            type="button"
            className="rounded border border-slate-700 px-4 py-2"
            onClick={() =>
              queueCommand({
                type: "ADJUST_MSRP",
                productId: view.id,
                newMsrp: view.msrp,
              })
            }
          >
            Queue MSRP review
          </button>
        </div>
      )}
    </article>
  );
}
