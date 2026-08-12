import { pathToFileURL } from "node:url";
import {
  hashWorldState,
  simulateDay,
  type EcosystemRiskState,
} from "../packages/sim-core/src/index";
import {
  BasicPublisherBot,
  CompletionPublisherBot,
  createBalancedWorld,
  createBrokenComboWorld,
  createCollectorBubbleWorld,
  createDeathSpiralWorld,
  createRevivalWorld,
  createScarceRareWorld,
  type WorldScenario,
} from "../packages/testkit/src/index";
import type { WorldState } from "../packages/domain/src/index";

export const SCENARIO_NAMES = [
  "balanced-world",
  "broken-combo-world",
  "scarce-rare-world",
  "collector-bubble-world",
  "death-spiral-world",
  "revival-world",
] as const;

export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export type SimulationOptions = {
  days: number;
  seed: string;
  scenario: ScenarioName;
  operationsFixture?: boolean;
};

export type SimulationSummary = {
  finalDay: number;
  activePlayers: number;
  hype: number;
  metaHealth: number;
  brandTrust: number;
  cash: number;
  marketListings: number;
  deckCount: number;
  riskState: EcosystemRiskState;
  stateHash: string;
};

export type SimulationRunResult = {
  finalState: WorldState;
  summary: SimulationSummary;
};

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const scenarioFactories: Record<ScenarioName, (seed: string) => WorldScenario> =
  {
    "balanced-world": createBalancedWorld,
    "broken-combo-world": createBrokenComboWorld,
    "scarce-rare-world": createScarceRareWorld,
    "collector-bubble-world": createCollectorBubbleWorld,
    "death-spiral-world": createDeathSpiralWorld,
    "revival-world": createRevivalWorld,
  };

function readOption(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new RangeError(`Expected ${name} followed by a value.`);
  }
  return value;
}

function validateOptions(options: SimulationOptions): void {
  if (!Number.isSafeInteger(options.days) || options.days <= 0) {
    throw new RangeError("--days must be a positive integer.");
  }
  if (options.seed.length === 0) {
    throw new RangeError("--seed must be a non-empty integer or string seed.");
  }
  if (!SCENARIO_NAMES.includes(options.scenario)) {
    throw new RangeError(`Unknown scenario: ${options.scenario}.`);
  }
}

export function parseSimulationArgs(
  argv: readonly string[],
): SimulationOptions {
  const daysValue = readOption(argv, "--days");
  if (
    daysValue === undefined ||
    !POSITIVE_INTEGER_PATTERN.test(daysValue) ||
    !Number.isSafeInteger(Number(daysValue))
  ) {
    throw new RangeError("--days must be a positive integer.");
  }
  const seed = readOption(argv, "--seed");
  if (seed === undefined || seed.length === 0) {
    throw new RangeError("--seed must be a non-empty integer or string seed.");
  }
  const scenarioValue = readOption(argv, "--scenario") ?? "balanced-world";
  if (!SCENARIO_NAMES.includes(scenarioValue as ScenarioName)) {
    throw new RangeError(`Unknown scenario: ${scenarioValue}.`);
  }

  return {
    days: Number(daysValue),
    seed,
    scenario: scenarioValue as ScenarioName,
    ...(argv.includes("--operations-fixture")
      ? { operationsFixture: true }
      : {}),
  };
}

export function runSimulation(options: SimulationOptions): SimulationRunResult {
  validateOptions(options);
  const scenario = scenarioFactories[options.scenario](options.seed);
  const bot = options.operationsFixture
    ? new CompletionPublisherBot()
    : new BasicPublisherBot(scenario.botConfig);
  let state = scenario.world;
  let stateHash = hashWorldState(state);

  for (
    let elapsedDays = 0;
    elapsedDays < options.days && state.status !== "GAME_OVER";
    elapsedDays += 1
  ) {
    const result = simulateDay(
      state,
      bot.decide(state),
      scenario.balanceConfig,
    );
    state = result.nextState;
    stateHash = result.stateHash;
  }

  return {
    finalState: state,
    summary: {
      finalDay: state.day,
      activePlayers: state.metrics.activePlayers,
      hype: state.metrics.hype,
      metaHealth: state.metrics.metaHealth,
      brandTrust: state.metrics.brandTrust,
      cash: state.cash.balance,
      marketListings: state.market.listings.length,
      deckCount: Object.keys(state.decks).length,
      riskState: state.metrics.ecosystemRisk,
      stateHash,
    },
  };
}

function run(argv: readonly string[]): void {
  const result = runSimulation(parseSimulationArgs(argv));
  process.stdout.write(`${JSON.stringify(result.summary)}\n`);
}

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  run(process.argv.slice(2));
}
