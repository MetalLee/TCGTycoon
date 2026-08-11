import { ECONOMY_CONFIG } from "@tcgtycoon/balance";
import {
  playerId,
  printingId,
  printRunId,
  productId,
  type PrintingId,
  type ProductId,
  type WorldState,
} from "@tcgtycoon/domain";
import {
  openStarter,
  resolvePrimarySales,
  type BalanceConfig,
  type WorldMetricState,
} from "@tcgtycoon/sim-core";
import { DeterministicRng, deriveSeed } from "@tcgtycoon/rules-engine";
import { fireFixtureDeck, machineFixtureDeck } from "../decks/core-fixtures";
import type { BasicPublisherBotConfig } from "../publisher/basic-publisher-bot";
import {
  createProductFixtureWorld,
  launchBoosterProductId,
  launchFireStarterProductId,
} from "./product-fixtures";

export const launchMachineStarterProductId = productId(
  "product-launch-starter-machine",
);

export type WorldScenario = {
  name:
    | "balanced-world"
    | "broken-combo-world"
    | "scarce-rare-world"
    | "collector-bubble-world"
    | "death-spiral-world"
    | "revival-world";
  purpose: string;
  world: WorldState;
  balanceConfig: BalanceConfig;
  metricState: WorldMetricState;
  botConfig: BasicPublisherBotConfig;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalPrintingId(cardId: string): PrintingId {
  return printingId(
    `printing-${cardId}${ECONOMY_CONFIG.printingVariantSuffixes.normal}`,
  );
}

function starterContents(
  cards: readonly { cardId: string; count: number }[],
): PrintingId[] {
  return cards.flatMap(({ cardId, count }) =>
    Array.from({ length: count }, () => normalPrintingId(cardId)),
  );
}

function retainScenarioPopulation(world: WorldState): void {
  const retainedIds = [playerId("player-0001"), playerId("player-0002")];
  world.players = Object.fromEntries(
    retainedIds.map((id) => [id, world.players[id]!] as const),
  );
  world.agents = Object.fromEntries(
    Object.values(world.agents)
      .filter((agent) => world.players[agent.playerId] !== undefined)
      .sort((left, right) => compareIds(left.id, right.id))
      .map((agent) => [agent.id, agent]),
  );
  world.cohorts = [{ id: "cohort-scenario", count: retainedIds.length }];
}

function addInitialInventory(world: WorldState): void {
  for (const [suffix, productId, quantity] of [
    ["booster", launchBoosterProductId, 20],
    ["fire-starter", launchFireStarterProductId, 12],
    ["machine-starter", launchMachineStarterProductId, 12],
  ] as const) {
    const id = printRunId(`print-run-scenario-${suffix}`);
    world.printRuns[id] = {
      id,
      productId,
      quantity,
      completionDay: world.day,
    };
  }
}

function sellAndOpenStarter(
  world: WorldState,
  buyerId: ReturnType<typeof playerId>,
  productId: ProductId,
  contents: readonly PrintingId[],
  seed: string,
): void {
  const sale = resolvePrimarySales(
    world,
    [{ buyerId, productId, quantity: 1 }],
    new DeterministicRng(deriveSeed([seed, "initial-starter-sale", buyerId])),
  );
  if (sale.openingRequests.length !== 1) {
    throw new Error(`Scenario starter sale failed for ${buyerId}.`);
  }
  openStarter(world, productId, buyerId, contents);
}

export function createBalancedWorld(seed = "balanced-world"): WorldScenario {
  const { world } = createProductFixtureWorld(seed);
  world.day = 1;
  world.status = "LIVE";
  world.cash = { balance: 25_000, ledger: [] };
  retainScenarioPopulation(world);

  const fireContents = starterContents(fireFixtureDeck.cards);
  const machineContents = starterContents(machineFixtureDeck.cards);
  const expansionId = world.products[launchBoosterProductId]!.expansionId;
  world.products[launchMachineStarterProductId] = {
    id: launchMachineStarterProductId,
    expansionId,
    name: "Launch Machine Starter",
    kind: "STARTER",
    msrp: 15,
  };
  addInitialInventory(world);

  const firePlayer = world.players[playerId("player-0001")]!;
  const machinePlayer = world.players[playerId("player-0002")]!;
  for (const player of [firePlayer, machinePlayer]) {
    player.activity = "ACTIVE";
    player.tenureDays = 30;
    player.tcgWallet = 500;
    player.satisfaction = 0.8;
  }
  sellAndOpenStarter(
    world,
    firePlayer.id,
    launchFireStarterProductId,
    fireContents,
    seed,
  );
  sellAndOpenStarter(
    world,
    machinePlayer.id,
    launchMachineStarterProductId,
    machineContents,
    seed,
  );
  firePlayer.deckIds = [fireFixtureDeck.id];
  firePlayer.knowledge = {
    knownCardIds: fireFixtureDeck.cards.map((entry) => entry.cardId),
    knownDeckIds: [fireFixtureDeck.id],
  };
  machinePlayer.deckIds = [machineFixtureDeck.id];
  machinePlayer.knowledge = {
    knownCardIds: machineFixtureDeck.cards.map((entry) => entry.cardId),
    knownDeckIds: [machineFixtureDeck.id],
  };
  world.metrics.activePlayers = 2;

  return {
    name: "balanced-world",
    purpose:
      "Stable two-deck world used for deterministic growth and long-run checks.",
    world,
    balanceConfig: {
      starterContents: {
        [launchFireStarterProductId]: fireContents,
        [launchMachineStarterProductId]: machineContents,
      },
      dailyOperatingCost: 1,
      inventoryHoldingCostPerUnit: 0,
    },
    metricState: {
      hype: 50,
      collectorHeat: 45,
      metaHealth: 50,
      brandTrust: 60,
      sentiment: 60,
    },
    botConfig: {
      stockThreshold: 8,
      reprintQuantity: 12,
      leadTimeDays: 2,
      minimumCashReserve: 1_000,
      estimatedPrintCostPerUnit: 2,
    },
  };
}
