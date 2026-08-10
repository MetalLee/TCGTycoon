import { RULES_CONFIG } from "@tcgtycoon/balance";
import {
  cardId,
  factionId,
  matchId,
  type CardDefinition,
  type CardId,
  type Keyword,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { resolveEffect } from "./effects";
import { heroTargetId, type EffectSource } from "./targeting";
import type { ResolutionContext } from "./triggers";
import type { MatchState, UnitInstance } from "./types";

const fireFactionId = factionId("fire");

function definition(
  id: string,
  type: "UNIT" | "SPELL" = "UNIT",
): CardDefinition {
  const base = {
    id: cardId(id),
    name: id,
    factionId: fireFactionId,
    rarity: "COMMON" as const,
    cost: 1,
    keywords: [] as Keyword[],
    triggers: [],
  };
  return type === "UNIT"
    ? { ...base, type, attack: 2, health: 2 }
    : { ...base, type };
}

function unit(
  id: string,
  side: "A" | "B",
  options: {
    attack?: number;
    health?: number;
    keywords?: Keyword[];
  } = {},
): [UnitInstance, EffectSource] {
  const health = options.health ?? 3;
  const card = {
    instanceId: id,
    cardId: cardId(`card-${id}`),
    attack: options.attack ?? 2,
    health,
    maxHealth: health,
    keywords: options.keywords ?? [],
    summonedTurn: 0,
    attacksThisTurn: 0,
    lastAttackTurn: 0,
  };
  return [card, { side, instanceId: id, cardId: card.cardId }];
}

function context(
  boardA: UnitInstance[],
  boardB: UnitInstance[],
  source: EffectSource,
  definitions: CardDefinition[] = [],
): ResolutionContext {
  const player = () => ({
    heroHealth: RULES_CONFIG.heroHealth,
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
  playerA.board = boardA;
  playerB.board = boardB;
  const state: MatchState = {
    matchId: matchId("match-effects"),
    matchSeed: 9876n,
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
    cardDefinitions: new Map(definitions.map((card) => [card.id, card])),
    queue: [],
    actionCount: 0,
    triggerDepth: 0,
    summonsThisChain: 0,
    warnings: [],
    source,
  };
}

describe("effect resolution", () => {
  it("resolves damage, Divine Shield prevention, healing, draw and discard", () => {
    const [sourceUnit, source] = unit("source", "A");
    const [shielded] = unit("shielded", "B", {
      health: 4,
      keywords: ["DIVINE_SHIELD"],
    });
    const ctx = context([sourceUnit], [shielded], source);
    ctx.state.players.A.heroHealth = 10;
    ctx.state.players.A.deck = [cardId("card-draw-two"), cardId("card-draw-one")];
    ctx.state.players.B.hand = [
      { instanceId: "discard-one", cardId: cardId("card-discard-one") },
      { instanceId: "discard-two", cardId: cardId("card-discard-two") },
    ];

    ctx.selectedTargetId = shielded.instanceId;
    resolveEffect(ctx, { type: "DEAL_DAMAGE", amount: 3, target: "ENEMY_UNIT" });
    expect(shielded).toMatchObject({ health: 4, keywords: [] });

    resolveEffect(ctx, { type: "DEAL_DAMAGE", amount: 3, target: "ENEMY_UNIT" });
    expect(shielded.health).toBe(1);

    ctx.selectedTargetId = heroTargetId("A");
    resolveEffect(ctx, { type: "HEAL", amount: 4, target: "FRIENDLY_HERO" });
    expect(ctx.state.players.A.heroHealth).toBe(14);

    resolveEffect(ctx, { type: "DRAW", amount: 2, target: "FRIENDLY_HERO" });
    expect(ctx.state.players.A.hand).toHaveLength(2);

    ctx.selectedTargetId = heroTargetId("B");
    resolveEffect(ctx, { type: "DISCARD", amount: 1, target: "ENEMY_HERO" });
    expect(ctx.state.players.B.hand).toHaveLength(1);
    expect(ctx.state.players.B.discard).toHaveLength(1);
  });

  it("summons tokens within board and chain limits and destroys units", () => {
    const [sourceUnit, source] = unit("source", "A");
    const [enemy] = unit("enemy", "B");
    const token = definition("card-token");
    const ctx = context([sourceUnit], [enemy], source, [token]);

    resolveEffect(ctx, { type: "SUMMON", tokenCardId: token.id, amount: 10 });

    expect(ctx.state.players.A.board).toHaveLength(RULES_CONFIG.boardLimit);
    expect(ctx.summonsThisChain).toBe(RULES_CONFIG.boardLimit - 1);
    expect(ctx.state.players.A.board.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardId: token.id, attack: 2, health: 2 }),
      ]),
    );

    ctx.selectedTargetId = enemy.instanceId;
    resolveEffect(ctx, { type: "DESTROY", target: "ENEMY_UNIT" });
    expect(ctx.state.players.B.board).toEqual([]);
  });

  it("applies stat and keyword changes", () => {
    const [sourceUnit, source] = unit("source", "A", { attack: 3, health: 4 });
    const [enemy] = unit("enemy", "B", { attack: 4, health: 5 });
    const ctx = context([sourceUnit], [enemy], source);

    ctx.selectedTargetId = sourceUnit.instanceId;
    resolveEffect(ctx, { type: "BUFF_ATTACK", amount: 2, target: "FRIENDLY_UNIT" });
    resolveEffect(ctx, { type: "BUFF_HEALTH", amount: 2, target: "FRIENDLY_UNIT" });
    resolveEffect(ctx, { type: "BUFF_STATS", amount: 1, target: "FRIENDLY_UNIT" });
    resolveEffect(ctx, {
      type: "GAIN_KEYWORD",
      keyword: "TAUNT",
      target: "FRIENDLY_UNIT",
    });
    expect(sourceUnit).toMatchObject({
      attack: 6,
      health: 7,
      maxHealth: 7,
      keywords: ["TAUNT"],
    });

    ctx.selectedTargetId = enemy.instanceId;
    resolveEffect(ctx, { type: "DEBUFF_ATTACK", amount: 9, target: "ENEMY_UNIT" });
    resolveEffect(ctx, { type: "DEBUFF_HEALTH", amount: 2, target: "ENEMY_UNIT" });
    resolveEffect(ctx, {
      type: "GAIN_KEYWORD",
      keyword: "TAUNT",
      target: "ENEMY_UNIT",
    });
    resolveEffect(ctx, {
      type: "REMOVE_KEYWORD",
      keyword: "TAUNT",
      target: "ENEMY_UNIT",
    });
    expect(enemy).toMatchObject({ attack: 0, health: 3, maxHealth: 3, keywords: [] });
  });

  it("creates, copies and returns cards while respecting the hand limit", () => {
    const [sourceUnit, source] = unit("source", "A");
    const [enemy] = unit("enemy", "B");
    const created = definition("card-created", "SPELL");
    const ctx = context([sourceUnit], [enemy], source, [created]);

    resolveEffect(ctx, { type: "CREATE_CARD", cardId: created.id, amount: 2 });
    expect(ctx.state.players.A.hand.map((card) => card.cardId)).toEqual([
      created.id,
      created.id,
    ]);

    ctx.selectedTargetId = enemy.instanceId;
    resolveEffect(ctx, {
      type: "COPY_CARD",
      target: "ENEMY_UNIT",
      destination: "HAND",
    });
    expect(ctx.state.players.A.hand.at(-1)?.cardId).toBe(enemy.cardId);

    ctx.selectedTargetId = sourceUnit.instanceId;
    resolveEffect(ctx, { type: "RETURN_TO_HAND", target: "FRIENDLY_UNIT" });
    expect(ctx.state.players.A.board).toEqual([]);
    expect(ctx.state.players.A.hand.at(-1)?.instanceId).toBe(sourceUnit.instanceId);
  });

  it("gains temporary and permanent mana within the permanent cap", () => {
    const [sourceUnit, source] = unit("source", "A");
    const ctx = context([sourceUnit], [], source);
    ctx.state.players.A.maxMana = RULES_CONFIG.maxMana - 1;
    ctx.state.players.A.mana = 2;

    resolveEffect(ctx, { type: "GAIN_MANA_THIS_TURN", amount: 2 });
    resolveEffect(ctx, { type: "GAIN_MAX_MANA", amount: 5 });

    expect(ctx.state.players.A.mana).toBe(4);
    expect(ctx.state.players.A.maxMana).toBe(RULES_CONFIG.maxMana);
  });
});
