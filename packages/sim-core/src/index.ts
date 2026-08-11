export const SIMULATION_VERSION = "1" as const;

export * from "./deck-evolution/adoption";
export * from "./deck-evolution/deck-builder";
export * from "./deck-evolution/deck-genome";
export { appendCashEntry } from "./economy/cash-ledger";
export * from "./market/call-auction";
export * from "./market/market-intents";
export * from "./meta/meta-aggregation";
export * from "./meta/sample-matches";
export * from "./metrics/accessibility";
export * from "./metrics/ecosystem-risk";
export * from "./metrics/satisfaction";
export * from "./metrics/world-metrics";
export * from "./population/create-population";
export * from "./population/lifecycle";
export * from "./products/open-product";
export * from "./products/primary-market";
export * from "./society/knowledge";
