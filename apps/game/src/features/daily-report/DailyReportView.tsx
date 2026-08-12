import type { WorldEvent } from "../../../../../packages/domain/src/index";
import type { DailyReport } from "../../../../../packages/sim-core/src/index";
import { Link } from "react-router";
import { FactValue } from "../../components/semantics/FactValue";

const MAX_STORIES = 6;

export type DailyReportStoryEntity = Readonly<{
  kind:
    "card" | "expansion" | "market" | "operations" | "tournament" | "dashboard";
  id: string;
  href: string;
}>;

export type DailyReportStory = Readonly<{
  id: string;
  priority: number;
  title: string;
  summary: string;
  entity: DailyReportStoryEntity;
}>;

type ParsedEventReason = {
  tournamentId?: string;
  name?: string;
  cardId?: string;
  expansionId?: string;
  winner?: { deckId?: string };
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseReason(reason: string | undefined): ParsedEventReason {
  if (reason === undefined) return {};
  try {
    return JSON.parse(reason) as ParsedEventReason;
  } catch {
    return {};
  }
}

function titleCaseEvent(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function entityForEvent(event: WorldEvent): DailyReportStoryEntity {
  if (event.context?.productId !== undefined) {
    return {
      kind: "market",
      id: event.context.productId,
      href: `/products/${event.context.productId}`,
    };
  }
  const parsed = parseReason(event.context?.reason);
  const tournamentId = parsed.tournamentId;
  if (event.type.includes("TOURNAMENT") && tournamentId !== undefined) {
    return {
      kind: "tournament",
      id: tournamentId,
      href: `/tournaments/${tournamentId}`,
    };
  }
  if (event.type === "PLAYTEST_COMPLETED") {
    const expansionId = event.context?.reason?.split(":")[0] ?? "expansions";
    return {
      kind: "expansion",
      id: expansionId,
      href: `/expansions/${expansionId}`,
    };
  }
  if (event.type === "POLICY_CHANGE_EFFECTIVE") {
    const cardId = event.context?.reason?.split(":")[1];
    if (cardId !== undefined) {
      return { kind: "card", id: cardId, href: `/cards/${cardId}` };
    }
  }
  if (parsed.cardId !== undefined) {
    return {
      kind: "card",
      id: parsed.cardId,
      href: `/cards/${parsed.cardId}`,
    };
  }
  if (event.type.includes("MARKET") || event.type === "PRIMARY_PRODUCT_SALES") {
    return { kind: "market", id: "market", href: "/market" };
  }
  return { kind: "operations", id: event.id, href: "/operations" };
}

function eventPriority(event: WorldEvent): number {
  if (event.type === "TOURNAMENT_COMPLETED") return 100;
  if (event.type === "PLAYTEST_COMPLETED") return 95;
  if (event.type === "SHORT_SUPPLY_LAUNCH" || event.type === "RELEASE_DELAY") {
    return 90;
  }
  if (event.type === "POLICY_CHANGE_EFFECTIVE") return 85;
  if (event.type.startsWith("MILESTONE_")) return 80;
  if (event.type.includes("RELEASE")) return 70;
  if (event.type.includes("MARKET") || event.type.includes("SALES")) return 60;
  return 50;
}

function storyForEvent(event: WorldEvent): DailyReportStory {
  const parsed = parseReason(event.context?.reason);
  const entity = entityForEvent(event);
  const eventName = parsed.name;
  return {
    id: event.id,
    priority: eventPriority(event),
    title: eventName ?? titleCaseEvent(event.type),
    summary: `Open the related ${entity.kind} record for the structured details behind this event.`,
    entity,
  };
}

function factStories(report: DailyReport): DailyReportStory[] {
  return [
    {
      id: `day-${report.day}-meta-health`,
      priority: 40,
      title: `Meta Health closed at ${Math.round(report.metaHealth)}`,
      summary:
        "Review observed deck performance and the evidence behind the health score.",
      entity: { kind: "dashboard", id: "meta", href: "/meta" },
    },
    {
      id: `day-${report.day}-active-players`,
      priority: 35,
      title: `${report.activePlayers.toLocaleString("en-US")} active players`,
      summary:
        "Inspect the publisher health view for lifecycle and retention context.",
      entity: { kind: "dashboard", id: "dashboard", href: "/dashboard" },
    },
    {
      id: `day-${report.day}-primary-market`,
      priority: 30,
      title: `${report.unitsSold.toLocaleString("en-US")} products sold`,
      summary:
        "Review primary inventory, product availability, and market conditions.",
      entity: { kind: "market", id: "market", href: "/market" },
    },
    {
      id: `day-${report.day}-operations`,
      priority: 25,
      title: `${report.completedPrintRuns} Print Runs completed`,
      summary: "Review production and scheduled publisher work in Operations.",
      entity: { kind: "operations", id: "operations", href: "/operations" },
    },
  ];
}

export function selectDailyReportStories(
  report: DailyReport,
  notableEvents: readonly WorldEvent[],
): DailyReportStory[] {
  return [...notableEvents.map(storyForEvent), ...factStories(report)]
    .sort(
      (left, right) =>
        right.priority - left.priority || compareText(left.id, right.id),
    )
    .slice(0, MAX_STORIES);
}

export type DailyReportViewProps = {
  report: DailyReport;
  notableEvents: readonly WorldEvent[];
  previousReport?: DailyReport | undefined;
};

type MetricRow = {
  label: string;
  value: number;
  previous?: number | undefined;
  format?: "currency" | "integer";
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formattedMetric(row: MetricRow): string {
  return row.format === "currency"
    ? currencyFormatter.format(row.value)
    : numberFormatter.format(row.value);
}

function formattedDelta(row: MetricRow): string {
  if (row.previous === undefined) return "No prior report";
  const delta = row.value - row.previous;
  const formatted =
    row.format === "currency"
      ? currencyFormatter.format(Math.abs(delta))
      : numberFormatter.format(Math.abs(delta));
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatted}`;
}

export function DailyReportView({
  report,
  notableEvents,
  previousReport,
}: DailyReportViewProps) {
  const stories = selectDailyReportStories(report, notableEvents);
  const metrics: MetricRow[] = [
    {
      label: "Active Players",
      value: report.activePlayers,
      previous: previousReport?.activePlayers,
      format: "integer",
    },
    { label: "Hype", value: report.hype, previous: previousReport?.hype },
    {
      label: "Collector Heat",
      value: report.collectorHeat,
      previous: previousReport?.collectorHeat,
    },
    {
      label: "Meta Health",
      value: report.metaHealth,
      previous: previousReport?.metaHealth,
    },
    {
      label: "Brand Trust",
      value: report.brandTrust,
      previous: previousReport?.brandTrust,
    },
    {
      label: "Cash",
      value: report.cashBalance,
      previous: previousReport?.cashBalance,
      format: "currency",
    },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="todays-story-title">
        <h2 id="todays-story-title" className="text-xl font-semibold">
          Today’s Story
        </h2>
        <ol className="mt-4 grid gap-4 lg:grid-cols-2">
          {stories.map((story) => (
            <li key={story.id}>
              <Link
                to={story.entity.href}
                data-entity-kind={story.entity.kind}
                data-entity-id={story.entity.id}
                className="block h-full rounded-lg border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-700"
              >
                <p className="font-semibold text-slate-100">{story.title}</p>
                <p className="mt-2 text-sm text-slate-400">{story.summary}</p>
                <span className="mt-4 inline-block text-sm text-emerald-300">
                  Inspect details →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="metric-summary-title">
        <h2 id="metric-summary-title" className="text-xl font-semibold">
          Metric Summary
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((row) => (
            <div key={row.label}>
              <FactValue label={row.label} value={formattedMetric(row)} />
              <p className="mt-1 px-1 text-xs text-slate-400">
                Daily delta: {formattedDelta(row)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
