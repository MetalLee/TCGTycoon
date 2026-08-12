import {
  cardId,
  expansionId,
  factionId,
  type CardDefinition,
  type WorldState,
} from "@tcgtycoon/domain";
import { createInitialWorldMetrics } from "../metrics/world-metrics";

export function createPublisherTestWorld(seed: string): WorldState {
  const cards: CardDefinition[] = Array.from({ length: 24 }, (_, index) => ({
    id: cardId(`card-publisher-${String(index + 1).padStart(2, "0")}`),
    name: `Publisher Card ${index + 1}`,
    type: "UNIT",
    factionId: factionId(index % 2 === 0 ? "ember" : "tide"),
    rarity: "COMMON",
    cost: (index % 8) + 1,
    attack: (index % 6) + 1,
    health: (index % 7) + 1,
    keywords: [],
    triggers: [],
  }));
  return {
    schemaVersion: 6,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: seed,
    day: 1,
    status: "LIVE",
    operations: {},
    expansionProjects: {},
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    printings: {},
    expansions: {
      "set-launch": { id: expansionId("set-launch"), name: "Launch Set" },
    },
    products: {},
    printRuns: {},
    players: {},
    agents: {},
    decks: {},
    cohorts: [],
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 0,
      interested: 0,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 0,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 100_000, ledger: [] },
    history: { events: [] },
  };
}
