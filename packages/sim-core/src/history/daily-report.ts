import type { LifecycleDeltas } from "@tcgtycoon/domain";
import type { EcosystemRiskState } from "../metrics/ecosystem-risk";

export type DailyReport = {
  day: number;
  completedPrintRuns: number;
  unitsSold: number;
  primaryRevenue: number;
  productsOpened: number;
  matchesSampled: number;
  marketTrades: number;
  activePlayers: number;
  accessibility: number;
  metaHealth: number;
  hype: number;
  collectorHeat: number;
  brandTrust: number;
  sentiment: number;
  lifecycleDeltas: LifecycleDeltas;
  cashBalance: number;
  ecosystemRisk: EcosystemRiskState;
  notableEventCount: number;
};

export type DailyReportInput = DailyReport;

export function createDailyReport(input: DailyReportInput): DailyReport {
  return { ...input };
}
