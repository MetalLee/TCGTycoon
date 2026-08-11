import { pathToFileURL } from "node:url";
import {
  simulateMatch,
  type BattleStrategy,
} from "../packages/rules-engine/src/battle/match-engine";
import { hashMatchResult } from "../packages/rules-engine/src/replay/hash-result";
import {
  coreCardFixtures,
  fireFixtureDeck,
  machineFixtureDeck,
} from "../packages/testkit/src";

const INTEGER_PATTERN = /^-?\d+$/;
const baselineStrategy: BattleStrategy = {
  aggression: 0.5,
  value: 0.5,
  preservation: 0.5,
};

export function parseSeedArg(argv: string[]): bigint {
  const seedIndex = argv.indexOf("--seed");
  const seedValue = seedIndex === -1 ? undefined : argv[seedIndex + 1];
  if (seedValue === undefined || !INTEGER_PATTERN.test(seedValue)) {
    throw new RangeError("Expected --seed followed by an integer.");
  }
  return BigInt(seedValue);
}

function simulateFixtureMatch(seed: bigint) {
  return simulateMatch({
    seed,
    deckA: fireFixtureDeck,
    deckB: machineFixtureDeck,
    cards: new Map(coreCardFixtures.map((card) => [card.id, card])),
    strategyA: baselineStrategy,
    strategyB: baselineStrategy,
    recordActionLog: true,
  });
}

function run(argv: string[]): void {
  const seed = parseSeedArg(argv);
  const result = simulateFixtureMatch(seed);
  const summary = {
    seed: seed.toString(),
    winner: result.winner,
    turns: result.turns,
    warnings: result.warnings,
    resultHash: hashMatchResult(result),
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  run(process.argv.slice(2));
}
