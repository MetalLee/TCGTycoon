import { EstimateValue } from "../../components/semantics/EstimateValue";
import { FactValue } from "../../components/semantics/FactValue";
import type { DashboardViewModel } from "../../selectors/dashboard";

export type DashboardViewProps = {
  view: DashboardViewModel;
};

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const cashFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatHealthValue(
  key: keyof DashboardViewModel["healthOverview"],
  value: number,
): string {
  return key === "cash"
    ? cashFormatter.format(value)
    : integerFormatter.format(value);
}

export function DashboardView({ view }: DashboardViewProps) {
  const health = Object.entries(view.healthOverview) as [
    keyof DashboardViewModel["healthOverview"],
    DashboardViewModel["healthOverview"][keyof DashboardViewModel["healthOverview"]],
  ][];
  return (
    <div className="space-y-10">
      <section aria-labelledby="health-overview-title">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Publisher health
          </p>
          <h2 id="health-overview-title" className="mt-2 text-xl font-semibold">
            Health Overview
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {health.map(([key, item]) => (
            <FactValue
              key={key}
              label={item.label}
              value={formatHealthValue(key, item.value)}
            />
          ))}
          <EstimateValue
            label={view.conservativeRunway.label}
            value={
              view.conservativeRunway.value === null
                ? "No burn recorded"
                : `${view.conservativeRunway.value} days`
            }
            basis={view.conservativeRunway.basis}
          />
        </div>
      </section>

      <section aria-labelledby="current-drivers-title">
        <h2 id="current-drivers-title" className="text-xl font-semibold">
          Current Drivers
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(
            [
              ["Positive contributors", view.currentDrivers.positive],
              ["Negative contributors", view.currentDrivers.negative],
            ] as const
          ).map(([title, drivers]) => (
            <article
              key={title}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
            >
              <h3 className="font-semibold">{title}</h3>
              {drivers.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">
                  No material contributor detected.
                </p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {drivers.map((driver) => (
                    <li
                      key={driver.key}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span>{driver.label}</span>
                      <span
                        className={
                          driver.impact > 0
                            ? "text-emerald-300"
                            : "text-red-300"
                        }
                      >
                        {driver.impact > 0 ? "+" : ""}
                        {driver.impact.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="leading-indicators-title">
        <h2 id="leading-indicators-title" className="text-xl font-semibold">
          Leading Indicators
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FactValue
            label={view.leadingIndicators.retentionRate.label}
            value={`${(view.leadingIndicators.retentionRate.value * 100).toFixed(1)}%`}
          />
          <FactValue
            label={view.leadingIndicators.acquisitionToChurnRatio.label}
            value={view.leadingIndicators.acquisitionToChurnRatio.value.toFixed(
              2,
            )}
          />
        </div>
      </section>
    </div>
  );
}
