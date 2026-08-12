import { readFileSync } from "node:fs";

import {
  productId,
  type PublisherCommand,
  type SaveEnvelope,
  type WorldState,
} from "../../packages/domain/src/index";
import {
  canonicalStringify,
  migrateSave,
} from "../../packages/persistence/src/index";
import { deriveSeed } from "../../packages/rules-engine/src/index";
import {
  DEFAULT_BALANCE_CONFIG,
  simulateDay,
} from "../../packages/sim-core/src/index";
import { createParityTestSave } from "../../packages/testkit/src/worlds/create-test-world";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixtureUrl = new URL("./fixture-save.json", import.meta.url);
const originalTimezone = process.env.TZ;

const parityCommands = [
  {
    type: "ADJUST_MSRP",
    productId: productId("product-launch-booster"),
    newMsrp: 5.5,
  },
  {
    type: "PUBLISH_ANNOUNCEMENT",
    topic: "TOURNAMENT",
    text: "The Parity Open begins today.",
    subjectId: "tournament-parity-open",
  },
] satisfies readonly PublisherCommand[];

const expectedParityStateHash = "9ef9edfc09dcab0e";
const expectedImportantMatchHashes = ["7e57283c19b865d5"];

type StoredTournamentMatch = {
  id: string;
  isFinal: boolean;
  isNotableUpset: boolean;
  replay?: unknown;
};

type ParityResult = {
  canonicalJson: string;
  stateHash: string;
  importantMatchHashes: string[];
  cashBalance: number;
  metrics: WorldState["metrics"];
  marketQuantities: {
    listedUnits: number;
    availableSupply: number;
    dailyVolume: number;
    priceHistoryVolume: number;
  };
};

function stableHash(label: string, value: unknown): string {
  return deriveSeed([label, canonicalStringify(value)])
    .toString(16)
    .padStart(16, "0");
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function importantMatchHashes(state: WorldState): string[] {
  const matches = state.history.events.flatMap((event) => {
    if (
      event.type !== "TOURNAMENT_COMPLETED" ||
      event.context?.reason === undefined
    ) {
      return [];
    }
    const result = JSON.parse(event.context.reason) as {
      matches?: StoredTournamentMatch[];
    };
    return result.matches ?? [];
  });

  return matches
    .filter(
      (match) =>
        match.replay !== undefined && (match.isFinal || match.isNotableUpset),
    )
    .sort((left, right) => compareIds(left.id, right.id))
    .map((match) => stableHash("important-match", match));
}

function summarize(save: SaveEnvelope): ParityResult {
  const result = simulateDay(
    save.state,
    parityCommands,
    DEFAULT_BALANCE_CONFIG,
  );
  const snapshots = Object.values(result.nextState.market.snapshots);

  return {
    canonicalJson: canonicalStringify(result.nextState),
    stateHash: result.stateHash,
    importantMatchHashes: importantMatchHashes(result.nextState),
    cashBalance: result.nextState.cash.balance,
    metrics: result.nextState.metrics,
    marketQuantities: {
      listedUnits: result.nextState.market.listings.reduce(
        (total, listing) => total + listing.quantity,
        0,
      ),
      availableSupply: snapshots.reduce(
        (total, snapshot) => total + snapshot.availableSupply,
        0,
      ),
      dailyVolume: snapshots.reduce(
        (total, snapshot) => total + snapshot.dailyVolume,
        0,
      ),
      priceHistoryVolume: snapshots.reduce(
        (total, snapshot) =>
          total +
          snapshot.priceHistory.reduce(
            (snapshotTotal, entry) => snapshotTotal + entry.volume,
            0,
          ),
        0,
      ),
    },
  };
}

async function loadBrowserCompatibleSave(
  fixtureText: string,
): Promise<SaveEnvelope> {
  return migrateSave(await new Response(fixtureText).json());
}

function loadDesktopCompatibleSave(): SaveEnvelope {
  return migrateSave(JSON.parse(readFileSync(fixtureUrl, "utf8")));
}

async function runAt(
  instant: string,
  timezone: string,
  load: () => SaveEnvelope | Promise<SaveEnvelope>,
): Promise<ParityResult> {
  process.env.TZ = timezone;
  vi.setSystemTime(instant);
  return summarize(await load());
}

afterEach(() => {
  vi.useRealTimers();
  if (originalTimezone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTimezone;
  }
});

describe("Web/Desktop deterministic simulation parity", () => {
  it("keeps the committed canonical save generated from testkit code", () => {
    const fixtureText = readFileSync(fixtureUrl, "utf8").trim();
    const save = migrateSave(JSON.parse(fixtureText));

    expect(canonicalStringify(save)).toBe(
      canonicalStringify(createParityTestSave()),
    );
    expect(Object.keys(save.state.cards).length).toBeGreaterThan(0);
    expect(Object.keys(save.state.products).length).toBeGreaterThan(0);
    expect(Object.keys(save.state.players).length).toBeGreaterThan(1);
    expect(
      Object.values(save.state.players).some(
        (player) => Object.keys(player.collection).length > 0,
      ),
    ).toBe(true);
    expect(Object.keys(save.state.meta.deckStats).length).toBeGreaterThan(0);
    expect(
      Object.values(save.state.operations ?? {}).some(
        (operation) =>
          operation.status === "PLANNED" || operation.status === "ACTIVE",
      ),
    ).toBe(true);
  });

  it("produces one regression result across platform loaders and wall clocks", async () => {
    vi.useFakeTimers();
    const fixtureText = readFileSync(fixtureUrl, "utf8");

    const browser = await runAt(
      "1999-12-31T23:59:59.000Z",
      "Pacific/Honolulu",
      () => loadBrowserCompatibleSave(fixtureText),
    );
    const desktop = await runAt(
      "2040-06-15T12:34:56.000Z",
      "Asia/Tokyo",
      loadDesktopCompatibleSave,
    );

    expect(browser).toEqual(desktop);
    expect(browser.stateHash).toBe(expectedParityStateHash);
    expect(browser.importantMatchHashes).toEqual(expectedImportantMatchHashes);
  });
});
