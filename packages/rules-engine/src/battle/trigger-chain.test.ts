import { RULES_CONFIG } from "@tcgtycoon/balance";
import {
  cardId,
  factionId,
  matchId,
  type CardDefinition,
  type CardId,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { resolveEffect } from "./effects";
import {
  enqueueTriggers,
  resolveTriggerQueue,
  type ResolutionContext,
} from "./triggers";
import { checkStateBasedDeaths } from "./state-check";
import type { MatchState, UnitInstance } from "./types";

function loopingDefinition(): CardDefinition {
  return {
    id: cardId("card-looping-apprentice"),
    name: "Looping Apprentice",
    type: "UNIT",
    factionId: factionId("fire"),
    rarity: "COMMON",
    cost: 1,
    attack: 1,
    health: 2,
    keywords: [],
    triggers: [
      {
        trigger: "AFTER_DAMAGE",
        conditions: [],
        effects: [{ type: "DEAL_DAMAGE", amount: 1, target: "ENEMY_HERO" }],
      },
    ],
  };
}

function context(): ResolutionContext {
  const definition = loopingDefinition();
  const loopUnit: UnitInstance = {
    instanceId: "loop-unit",
    cardId: definition.id,
    attack: 1,
    health: 2,
    maxHealth: 2,
    keywords: [],
    summonedTurn: 0,
    attacksThisTurn: 0,
    lastAttackTurn: 0,
  };
  const player = () => ({
    heroHealth: 1_000,
    deck: [] as CardId[],
    hand: [],
    board: [] as UnitInstance[],
    discard: [],
    maxMana: 0,
    mana: 0,
    fatigue: 0,
  });
  const playerA = player();
  const playerB = player();
  playerA.board = [loopUnit];
  const state: MatchState = {
    matchId: matchId("match-trigger-loop"),
    matchSeed: 4321n,
    turnNumber: 1,
    activeSide: "A",
    players: { A: playerA, B: playerB },
    actionLog: [],
    winner: null,
    mulliganCompleted: { A: true, B: true },
    nextInstanceSequence: 0,
    nextLogSequence: 0,
  };
  return {
    state,
    cardDefinitions: new Map([[definition.id, definition]]),
    queue: [],
    actionCount: 0,
    triggerDepth: 0,
    summonsThisChain: 0,
    warnings: [],
    source: {
      side: "A",
      instanceId: loopUnit.instanceId,
      cardId: loopUnit.cardId,
    },
  };
}

describe("trigger-chain safety", () => {
  it("terminates a looping trigger with a structured warning", () => {
    const ctx = context();

    enqueueTriggers(ctx, { type: "AFTER_DAMAGE", source: ctx.source });
    resolveTriggerQueue(ctx);

    expect(ctx.warnings).toContainEqual(
      expect.objectContaining({ code: "POTENTIAL_INFINITE_COMBO" }),
    );
    expect(ctx.queue).toEqual([]);
    expect(ctx.actionCount).toBeLessThanOrEqual(
      RULES_CONFIG.maxActionsPerChain,
    );
  });

  it("never executes more effects than the configured action limit", () => {
    const ctx = context();

    for (let index = 0; index <= RULES_CONFIG.maxActionsPerChain; index += 1) {
      resolveEffect(ctx, {
        type: "GAIN_MANA_THIS_TURN",
        amount: 1,
      });
    }

    expect(ctx.actionCount).toBe(RULES_CONFIG.maxActionsPerChain);
    expect(ctx.warnings).toContainEqual(
      expect.objectContaining({ code: "POTENTIAL_INFINITE_COMBO" }),
    );
  });

  it("queues death triggers before already-pending aftermath triggers", () => {
    const ctx = context();
    const doomedDefinition: CardDefinition = {
      ...loopingDefinition(),
      id: cardId("card-doomed"),
      name: "Doomed",
      triggers: [
        {
          trigger: "ON_DEATH",
          conditions: [],
          effects: [{ type: "DRAW", amount: 1, target: "FRIENDLY_HERO" }],
        },
      ],
    };
    const doomed: UnitInstance = {
      ...ctx.state.players.A.board[0]!,
      instanceId: "doomed",
      cardId: doomedDefinition.id,
      health: 0,
      keywords: ["DEATHRATTLE"],
    };
    ctx.state.players.A.board.push(doomed);
    ctx.cardDefinitions = new Map([
      ...ctx.cardDefinitions,
      [doomedDefinition.id, doomedDefinition],
    ]);

    enqueueTriggers(ctx, { type: "AFTER_DAMAGE", source: ctx.source });
    checkStateBasedDeaths(ctx);

    expect(ctx.queue.map((pending) => pending.trigger.trigger)).toEqual([
      "ON_DEATH",
      "AFTER_DAMAGE",
    ]);
  });
});
