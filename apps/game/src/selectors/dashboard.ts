import type {
  CashLedgerEntry,
  WorldMetrics,
} from "../../../../packages/domain/src/index";

const RUNWAY_LOOKBACK_DAYS = 7;
const DRIVER_BASELINE = 50;
const MAX_DRIVERS_PER_DIRECTION = 3;

type DashboardMetricKey =
  | "activePlayers"
  | "hype"
  | "collectorHeat"
  | "metaHealth"
  | "brandTrust"
  | "sentiment"
  | "accessibility";

export type DashboardWorld = Readonly<{
  day: number;
  metrics: Readonly<
    Pick<
      WorldMetrics,
      | "activePlayers"
      | "previousActivePlayers"
      | "activePlayerTrend"
      | "hype"
      | "collectorHeat"
      | "metaHealth"
      | "brandTrust"
      | "sentiment"
      | "accessibility"
      | "acquisitionToChurnRatio"
      | "retentionRate"
    >
  >;
  cash: Readonly<{
    balance: number;
    ledger: readonly Readonly<CashLedgerEntry>[];
  }>;
}>;

export type DashboardFact = Readonly<{
  label: string;
  value: number;
  semantic: "FACT";
}>;

export type DashboardDriver = Readonly<{
  key: DashboardMetricKey;
  label: string;
  impact: number;
}>;

export type DashboardViewModel = Readonly<{
  healthOverview: Readonly<{
    activePlayers: DashboardFact;
    hype: DashboardFact;
    collectorHeat: DashboardFact;
    metaHealth: DashboardFact;
    brandTrust: DashboardFact;
    cash: DashboardFact;
  }>;
  leadingIndicators: Readonly<{
    retentionRate: DashboardFact;
    acquisitionToChurnRatio: DashboardFact;
  }>;
  conservativeRunway: Readonly<{
    label: "Conservative Cash Runway";
    value: number | null;
    unit: "days";
    semantic: "ESTIMATE";
    basis: "7-day average recorded cash outflow";
  }>;
  currentDrivers: Readonly<{
    positive: readonly DashboardDriver[];
    negative: readonly DashboardDriver[];
  }>;
}>;

function fact(label: string, value: number): DashboardFact {
  return { label, value, semantic: "FACT" };
}

function conservativeRunway(world: DashboardWorld): number | null {
  const observedDays = Math.max(1, Math.min(RUNWAY_LOOKBACK_DAYS, world.day));
  const firstIncludedDay = world.day - observedDays + 1;
  const outflow = world.cash.ledger.reduce(
    (total, entry) =>
      entry.day >= firstIncludedDay &&
      entry.day <= world.day &&
      entry.amount < 0
        ? total - entry.amount
        : total,
    0,
  );
  if (outflow === 0) return null;
  const averageDailyOutflow = outflow / observedDays;
  return Math.max(0, Math.floor(world.cash.balance / averageDailyOutflow));
}

function compareDriverImpact(
  left: DashboardDriver,
  right: DashboardDriver,
): number {
  return (
    Math.abs(right.impact) - Math.abs(left.impact) ||
    (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  );
}

function selectDrivers(metrics: DashboardWorld["metrics"]): {
  positive: DashboardDriver[];
  negative: DashboardDriver[];
} {
  const candidates: DashboardDriver[] = [
    {
      key: "activePlayers",
      label: "Active Player Trend",
      impact: metrics.activePlayerTrend * 100,
    },
    { key: "hype", label: "Hype", impact: metrics.hype - DRIVER_BASELINE },
    {
      key: "collectorHeat",
      label: "Collector Heat",
      impact: metrics.collectorHeat - DRIVER_BASELINE,
    },
    {
      key: "metaHealth",
      label: "Meta Health",
      impact: metrics.metaHealth - DRIVER_BASELINE,
    },
    {
      key: "brandTrust",
      label: "Brand Trust",
      impact: metrics.brandTrust - DRIVER_BASELINE,
    },
    {
      key: "sentiment",
      label: "Sentiment",
      impact: metrics.sentiment - DRIVER_BASELINE,
    },
    {
      key: "accessibility",
      label: "Accessibility",
      impact: metrics.accessibility - DRIVER_BASELINE,
    },
  ];

  return {
    positive: candidates
      .filter((driver) => driver.impact > 0)
      .sort(compareDriverImpact)
      .slice(0, MAX_DRIVERS_PER_DIRECTION),
    negative: candidates
      .filter((driver) => driver.impact < 0)
      .sort(compareDriverImpact)
      .slice(0, MAX_DRIVERS_PER_DIRECTION),
  };
}

export function selectDashboardView(world: DashboardWorld): DashboardViewModel {
  return {
    healthOverview: {
      activePlayers: fact("Active Players", world.metrics.activePlayers),
      hype: fact("Hype", world.metrics.hype),
      collectorHeat: fact("Collector Heat", world.metrics.collectorHeat),
      metaHealth: fact("Meta Health", world.metrics.metaHealth),
      brandTrust: fact("Brand Trust", world.metrics.brandTrust),
      cash: fact("Cash", world.cash.balance),
    },
    leadingIndicators: {
      retentionRate: fact("7-day Retention", world.metrics.retentionRate),
      acquisitionToChurnRatio: fact(
        "Acquisition / Churn",
        world.metrics.acquisitionToChurnRatio,
      ),
    },
    conservativeRunway: {
      label: "Conservative Cash Runway",
      value: conservativeRunway(world),
      unit: "days",
      semantic: "ESTIMATE",
      basis: "7-day average recorded cash outflow",
    },
    currentDrivers: selectDrivers(world.metrics),
  };
}
