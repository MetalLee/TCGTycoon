import type { CardDefinition } from "./cards";
import type { WorldHistory } from "./events";
import type { MarketState } from "./market";
import type { DeckGenome, MetaState } from "./meta";
import type { WorldMetrics } from "./metrics";
import type { NamedAgent, PersistentPlayer, PopulationCohort } from "./players";
import type { Expansion, Printing, PrintRun, ProductSku } from "./products";

export type CashState = {
  balance: number;
  ledger: CashLedgerEntry[];
};

export type CashLedgerEntry = {
  day: number;
  category:
    | "BOOSTER_REVENUE"
    | "STARTER_REVENUE"
    | "PRINTING"
    | "OPERATING_COST"
    | "INVENTORY_COST";
  sourceId?: string;
  amount: number;
};

export type WorldState = {
  schemaVersion: number;
  simulationVersion: string;
  ruleVersion: string;
  balanceVersion: string;
  worldSeed: string;
  day: number;
  status: "SETUP" | "LIVE" | "GAME_OVER";
  cards: Record<string, CardDefinition>;
  printings: Record<string, Printing>;
  expansions: Record<string, Expansion>;
  products: Record<string, ProductSku>;
  printRuns: Record<string, PrintRun>;
  players: Record<string, PersistentPlayer>;
  agents: Record<string, NamedAgent>;
  decks: Record<string, DeckGenome>;
  cohorts: PopulationCohort[];
  market: MarketState;
  meta: MetaState;
  metrics: WorldMetrics;
  cash: CashState;
  history: WorldHistory;
};
