import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import {
  isMainThread,
  parentPort,
  workerData,
  Worker,
} from "node:worker_threads";

import type { WorldState } from "../packages/domain/src/index";
import {
  simulateDay,
  validateWorldInvariants,
  WorldInvariantError,
} from "../packages/sim-core/src/index";
import {
  BasicPublisherBot,
  createBalancedWorld,
} from "../packages/testkit/src/index";

export type LongSimulationOptions = {
  runs: number;
  days: number;
  seedPrefix: string;
  concurrency: number;
};

export type SeedSimulationOptions = {
  days: number;
  seed: string;
};

export type SeedSimulationSummary = {
  seed: string;
  initialDay: number;
  lifespan: number;
  maxActivePlayers: number;
  endingCash: number;
  expansions: number;
  bans: number;
  topDeckDominance: number;
  finalDay: number;
  finalStatus: WorldState["status"];
};

export type SeedSimulationResult = {
  finalState: WorldState;
  summary: SeedSimulationSummary;
};

export type LongSimulationReport = {
  options: LongSimulationOptions;
  results: SeedSimulationSummary[];
  invalidSeeds: string[];
  crashedSeeds: string[];
};

export type DistributionSummary = {
  minimum: number;
  median: number;
  maximum: number;
  mean: number;
};

export type LongSimulationReportSummary = {
  runs: number;
  completedRuns: number;
  invalidSeeds: string[];
  crashedSeeds: string[];
  distributions: {
    lifespan: DistributionSummary;
    maxActivePlayers: DistributionSummary;
    endingCash: DistributionSummary;
    expansions: DistributionSummary;
    bans: DistributionSummary;
    topDeckDominance: DistributionSummary;
  };
};

type SeedRunner = (
  options: SeedSimulationOptions,
) =>
  | SeedSimulationResult
  | SeedSimulationSummary
  | Promise<SeedSimulationResult | SeedSimulationSummary>;

type WorkerRequest = {
  kind: "RUN_SEED";
  options: SeedSimulationOptions;
};

type WorkerResponse =
  | { kind: "RESULT"; summary: SeedSimulationSummary }
  | { kind: "INVALID"; message: string }
  | { kind: "CRASHED"; message: string };

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export class LongRunInvariantError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LongRunInvariantError";
  }
}

function readOption(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new RangeError(`Expected ${name} followed by a value.`);
  }
  return value;
}

function positiveInteger(
  value: string | undefined,
  name: string,
  fallback: number,
): number {
  const resolved = value ?? String(fallback);
  if (
    !POSITIVE_INTEGER_PATTERN.test(resolved) ||
    !Number.isSafeInteger(Number(resolved))
  ) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return Number(resolved);
}

export function parseLongSimulationArgs(
  argv: readonly string[],
): LongSimulationOptions {
  const runs = positiveInteger(readOption(argv, "--runs"), "--runs", 100);
  const days = positiveInteger(readOption(argv, "--days"), "--days", 1_000);
  const seedPrefix = readOption(argv, "--seed-prefix") ?? "balance-smoke";
  if (seedPrefix.length === 0) {
    throw new RangeError("--seed-prefix must not be empty.");
  }
  const concurrency = positiveInteger(
    readOption(argv, "--concurrency"),
    "--concurrency",
    Math.min(runs, Math.max(1, Math.min(4, availableParallelism()))),
  );
  return { runs, days, seedPrefix, concurrency: Math.min(runs, concurrency) };
}

function assertFiniteTree(value: unknown, path: string): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new LongRunInvariantError(`${path} must be finite.`);
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertFiniteTree(entry, `${path}[${index}]`),
    );
    return;
  }
  for (const key of Object.keys(value).sort()) {
    assertFiniteTree((value as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

function assertNonNegativeSupply(world: WorldState): void {
  for (const run of Object.values(world.printRuns)) {
    if (run.quantity < 0 || run.orderedQuantity < 0) {
      throw new LongRunInvariantError(
        `Print Run ${run.id} contains negative supply.`,
      );
    }
  }
  for (const player of Object.values(world.players)) {
    for (const [printingId, quantity] of Object.entries(player.collection)) {
      if (quantity < 0) {
        throw new LongRunInvariantError(
          `Player ${player.id} owns negative supply of ${printingId}.`,
        );
      }
    }
  }
  for (const listing of world.market.listings) {
    if (listing.quantity < 0) {
      throw new LongRunInvariantError(
        `Market listing ${listing.ownerId}:${listing.printingId} is negative.`,
      );
    }
  }
}

export function validateLongRunState(
  world: WorldState,
  previousDay?: number,
): void {
  try {
    assertFiniteTree(world, "world");
    assertNonNegativeSupply(world);
    validateWorldInvariants(world, previousDay);
  } catch (error) {
    if (error instanceof LongRunInvariantError) throw error;
    if (error instanceof WorldInvariantError) {
      throw new LongRunInvariantError(error.message, { cause: error });
    }
    throw error;
  }
}

function topDeckDominance(world: WorldState): number {
  return Math.max(
    0,
    ...Object.values(world.meta.deckStats).map((stats) => stats.usageRate),
  );
}

function summarizeSeed(
  seed: string,
  initialDay: number,
  lifespan: number,
  maxActivePlayers: number,
  world: WorldState,
): SeedSimulationSummary {
  return {
    seed,
    initialDay,
    lifespan,
    maxActivePlayers,
    endingCash: world.cash.balance,
    expansions: Object.keys(world.expansions).length,
    bans: Object.values(world.operations ?? {}).filter(
      (operation) =>
        operation.type === "POLICY_CHANGE" && operation.payload.kind === "BAN",
    ).length,
    topDeckDominance: topDeckDominance(world),
    finalDay: world.day,
    finalStatus: world.status,
  };
}

export function runSeedSimulation(
  options: SeedSimulationOptions,
): SeedSimulationResult {
  if (!Number.isSafeInteger(options.days) || options.days <= 0) {
    throw new RangeError("days must be a positive integer.");
  }
  if (options.seed.length === 0) {
    throw new RangeError("seed must not be empty.");
  }
  const scenario = createBalancedWorld(options.seed);
  const bot = new BasicPublisherBot(scenario.botConfig);
  const initialDay = scenario.world.day;
  let state = scenario.world;
  let maxActivePlayers = state.metrics.activePlayers;
  let lifespan = 0;
  validateLongRunState(state);

  while (lifespan < options.days && state.status !== "GAME_OVER") {
    const previousDay = state.day;
    try {
      state = simulateDay(
        state,
        bot.decide(state),
        scenario.balanceConfig,
      ).nextState;
      validateLongRunState(state, previousDay);
    } catch (error) {
      if (error instanceof LongRunInvariantError) throw error;
      if (error instanceof WorldInvariantError) {
        throw new LongRunInvariantError(error.message, { cause: error });
      }
      throw error;
    }
    lifespan += 1;
    maxActivePlayers = Math.max(maxActivePlayers, state.metrics.activePlayers);
  }

  return {
    finalState: state,
    summary: summarizeSeed(
      options.seed,
      initialDay,
      lifespan,
      maxActivePlayers,
      state,
    ),
  };
}

function seedFor(options: LongSimulationOptions, index: number): string {
  return `${options.seedPrefix}-${String(index + 1).padStart(4, "0")}`;
}

function asSummary(
  result: SeedSimulationResult | SeedSimulationSummary,
): SeedSimulationSummary {
  return "summary" in result ? result.summary : result;
}

function classifyFailure(
  report: LongSimulationReport,
  seed: string,
  error: unknown,
): void {
  if (error instanceof LongRunInvariantError) {
    report.invalidSeeds.push(seed);
  } else {
    report.crashedSeeds.push(seed);
  }
}

async function runWithRunner(
  options: LongSimulationOptions,
  runner: SeedRunner,
): Promise<LongSimulationReport> {
  const report: LongSimulationReport = {
    options,
    results: [],
    invalidSeeds: [],
    crashedSeeds: [],
  };
  for (let index = 0; index < options.runs; index += 1) {
    const seed = seedFor(options, index);
    try {
      report.results.push(
        asSummary(await runner({ seed, days: options.days })),
      );
    } catch (error) {
      classifyFailure(report, seed, error);
    }
  }
  return report;
}

function runWorker(options: SeedSimulationOptions): Promise<WorkerResponse> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { kind: "RUN_SEED", options } satisfies WorkerRequest,
    });
    worker.once("message", (message: WorkerResponse) => resolve(message));
    worker.once("error", (error) =>
      resolve({ kind: "CRASHED", message: error.message }),
    );
    worker.once("exit", (code) => {
      if (code !== 0) {
        resolve({
          kind: "CRASHED",
          message: `Worker exited with code ${code}.`,
        });
      }
    });
  });
}

async function runWithWorkers(
  options: LongSimulationOptions,
): Promise<LongSimulationReport> {
  const report: LongSimulationReport = {
    options,
    results: [],
    invalidSeeds: [],
    crashedSeeds: [],
  };
  let nextIndex = 0;
  async function consume(): Promise<void> {
    while (nextIndex < options.runs) {
      const index = nextIndex;
      nextIndex += 1;
      const seed = seedFor(options, index);
      const response = await runWorker({ seed, days: options.days });
      if (response.kind === "RESULT") {
        report.results.push(response.summary);
      } else if (response.kind === "INVALID") {
        report.invalidSeeds.push(seed);
      } else {
        report.crashedSeeds.push(seed);
      }
    }
  }
  await Promise.all(
    Array.from({ length: options.concurrency }, () => consume()),
  );
  report.results.sort((left, right) => compareStrings(left.seed, right.seed));
  report.invalidSeeds.sort();
  report.crashedSeeds.sort();
  return report;
}

export async function runManySimulations(
  options: LongSimulationOptions,
  runner?: SeedRunner,
): Promise<LongSimulationReport> {
  if (runner !== undefined || options.concurrency === 1) {
    return runWithRunner(options, runner ?? runSeedSimulation);
  }
  return runWithWorkers(options);
}

function distribution(values: readonly number[]): DistributionSummary {
  if (values.length === 0) {
    return { minimum: 0, median: 0, maximum: 0, mean: 0 };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1]! + sorted[middle]!) / 2
      : sorted[middle]!;
  return {
    minimum: sorted[0]!,
    median,
    maximum: sorted.at(-1)!,
    mean: sorted.reduce((total, value) => total + value, 0) / sorted.length,
  };
}

export function summarizeLongSimulationReport(
  report: LongSimulationReport,
): LongSimulationReportSummary {
  const values = <Key extends keyof SeedSimulationSummary>(key: Key) =>
    report.results.map((result) => result[key] as number);
  return {
    runs: report.options.runs,
    completedRuns: report.results.length,
    invalidSeeds: [...report.invalidSeeds],
    crashedSeeds: [...report.crashedSeeds],
    distributions: {
      lifespan: distribution(values("lifespan")),
      maxActivePlayers: distribution(values("maxActivePlayers")),
      endingCash: distribution(values("endingCash")),
      expansions: distribution(values("expansions")),
      bans: distribution(values("bans")),
      topDeckDominance: distribution(values("topDeckDominance")),
    },
  };
}

async function runCli(argv: readonly string[]): Promise<void> {
  const report = await runManySimulations(parseLongSimulationArgs(argv));
  process.stdout.write(
    `${JSON.stringify(summarizeLongSimulationReport(report))}\n`,
  );
  if (report.invalidSeeds.length > 0 || report.crashedSeeds.length > 0) {
    process.exitCode = 1;
  }
}

if (!isMainThread) {
  const request = workerData as WorkerRequest;
  try {
    const result = runSeedSimulation(request.options);
    parentPort?.postMessage({
      kind: "RESULT",
      summary: result.summary,
    } satisfies WorkerResponse);
  } catch (error) {
    parentPort?.postMessage({
      kind: error instanceof LongRunInvariantError ? "INVALID" : "CRASHED",
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
} else {
  const entryPath = process.argv[1];
  if (
    entryPath !== undefined &&
    import.meta.url === pathToFileURL(entryPath).href
  ) {
    void runCli(process.argv.slice(2)).catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 1;
    });
  }
}
