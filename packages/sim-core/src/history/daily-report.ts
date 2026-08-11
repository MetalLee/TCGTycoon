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
  cashBalance: number;
  ecosystemRisk: EcosystemRiskState;
  notableEventCount: number;
};

export type DailyReportInput = DailyReport;

export function createDailyReport(input: DailyReportInput): DailyReport {
  return { ...input };
}
