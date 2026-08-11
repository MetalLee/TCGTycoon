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
import { enumerateLegalActions } from "../ai/battle-ai";
import {
  enqueueTriggers,
  resolveTriggerQueue,
  type ResolutionContext,
} from "./triggers";
import { getLegalTargets, heroTargetId, type EffectSource } from "./targeting";
import { checkStateBasedDeaths, performAttack } from "./state-check";
import type { MatchSide, MatchState, UnitInstance } from "./types";

const fireFactionId = factionId("fire");

function definition(
  id: string,
  keywords: Keyword[] = [],
  triggers: CardDefinition["triggers"] = [],
): CardDefinition {
  return {
    id: cardId(id),
    name: id,
    type: "UNIT",
    factionId: fireFactionId,
    rarity: "COMMON",
    cost: 1,
    attack: 1,
    health: 1,
    keywords,
    triggers,
  };
}

function unit(
  id: string,
  options: {
    attack?: number;
    health?: number;
    keywords?: Keyword[];
    summonedTurn?: number;
  } = {},
): UnitInstance {
  const health = options.health ?? 3;
  return {
    instanceId: id,
    cardId: cardId(`card-${id}`),
    attack: options.attack ?? 1,
    health,
    maxHealth: health,
    keywords: options.keywords ?? [],
    summonedTurn: options.summonedTurn ?? 0,
    attacksThisTurn: 0,
    lastAttackTurn: 0,
  };
}

function state(
  boardA: UnitInstance[] = [],
  boardB: UnitInstance[] = [],
): MatchState {
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
  return {
    matchId: matchId("match-keywords"),
    matchSeed: 12345n,
    turnNumber: 1,
    activeSide: "A",
    players: { A: playerA, B: playerB },
    actionLog: [],
    winner: null,
    mulliganCompleted: { A: true, B: true },
    nextInstanceSequence: 0,
    nextLogSequence: 0,
  };
}

function source(side: MatchSide, card: UnitInstance): EffectSource {
  return { side, instanceId: card.instanceId, cardId: card.cardId };
}

function context(
  matchState: MatchState,
  cardDefinitions: CardDefinition[] = [],
  effectSource?: EffectSource,
): ResolutionContext {
  return {
    state: matchState,
    cardDefinitions: new Map(cardDefinitions.map((card) => [card.id, card])),
    queue: [],
    actionCount: 0,
    triggerDepth: 0,
    summonsThisChain: 0,
    warnings: [],
    source:
      effectSource ??
      ({ side: "A", instanceId: "hero:A", cardId: cardId("hero-a") } as const),
  };
}

describe("core keywords", () => {
  it("TAUNT prevents attacks on other units and hero", () => {
    const attacker = unit("attacker", { attack: 2 });
    const taunt = unit("taunt", { keywords: ["TAUNT"] });
    const other = unit("other");
    const ctx = context(
      state([attacker], [taunt, other]),
      [],
      source("A", attacker),
    );

    expect(() =>
      performAttack(ctx, attacker.instanceId, other.instanceId),
    ).toThrow(/legal attack target/i);
    expect(() =>
      performAttack(ctx, attacker.instanceId, heroTargetId("B")),
    ).toThrow(/legal attack target/i);
    expect(() =>
      performAttack(ctx, attacker.instanceId, taunt.instanceId),
    ).not.toThrow();
  });

  it("CHARGE can attack hero immediately", () => {
    const attacker = unit("charger", {
      attack: 2,
      keywords: ["CHARGE"],
      summonedTurn: 1,
    });
    const matchState = state([attacker]);

    performAttack(
      context(matchState, [], source("A", attacker)),
      attacker.instanceId,
      heroTargetId("B"),
    );

    expect(matchState.players.B.heroHealth).toBe(RULES_CONFIG.heroHealth - 2);
  });

  it("RUSH can attack unit but not hero immediately", () => {
    const attacker = unit("rusher", {
      attack: 2,
      keywords: ["RUSH"],
      summonedTurn: 1,
    });
    const defender = unit("defender");
    const ctx = context(
      state([attacker], [defender]),
      [],
      source("A", attacker),
    );

    expect(() =>
      performAttack(ctx, attacker.instanceId, heroTargetId("B")),
    ).toThrow(/cannot attack the enemy hero/i);
    expect(() =>
      performAttack(ctx, attacker.instanceId, defender.instanceId),
    ).not.toThrow();
  });

  it("BATTLECRY triggers only when normally played from hand", () => {
    const herald = unit("herald", { keywords: ["BATTLECRY"] });
    const heraldDefinition = definition(
      "card-herald",
      ["BATTLECRY"],
      [
        {
          trigger: "ON_PLAY",
          conditions: [],
          effects: [{ type: "DEAL_DAMAGE", amount: 2, target: "ENEMY_HERO" }],
        },
      ],
    );
    const summonedState = state([herald]);
    const summonedCtx = context(
      summonedState,
      [heraldDefinition],
      source("A", herald),
    );

    enqueueTriggers(summonedCtx, {
      type: "ON_PLAY",
      source: source("A", herald),
      playedFromHand: false,
    });
    resolveTriggerQueue(summonedCtx);
    expect(summonedState.players.B.heroHealth).toBe(RULES_CONFIG.heroHealth);

    const playedState = state([herald]);
    const playedCtx = context(
      playedState,
      [heraldDefinition],
      source("A", herald),
    );
    enqueueTriggers(playedCtx, {
      type: "ON_PLAY",
      source: source("A", herald),
      playedFromHand: true,
    });
    resolveTriggerQueue(playedCtx);
    expect(playedState.players.B.heroHealth).toBe(RULES_CONFIG.heroHealth - 2);

    const withoutBattlecry = unit("herald-without-battlecry");
    withoutBattlecry.cardId = heraldDefinition.id;
    const withoutBattlecryState = state([withoutBattlecry]);
    const withoutBattlecryCtx = context(
      withoutBattlecryState,
      [heraldDefinition],
      source("A", withoutBattlecry),
    );
    enqueueTriggers(withoutBattlecryCtx, {
      type: "ON_PLAY",
      source: source("A", withoutBattlecry),
      playedFromHand: true,
    });
    resolveTriggerQueue(withoutBattlecryCtx);
    expect(withoutBattlecryState.players.B.heroHealth).toBe(
      RULES_CONFIG.heroHealth,
    );
  });

  it("DEATHRATTLE triggers after the unit leaves board", () => {
    const doomed = unit("doomed", { health: 0, keywords: ["DEATHRATTLE"] });
    const doomedDefinition = definition(
      "card-doomed",
      ["DEATHRATTLE"],
      [
        {
          trigger: "ON_DEATH",
          conditions: [],
          effects: [{ type: "DEAL_DAMAGE", amount: 2, target: "ENEMY_HERO" }],
        },
      ],
    );
    const matchState = state([doomed]);
    const ctx = context(matchState, [doomedDefinition], source("A", doomed));

    checkStateBasedDeaths(ctx);

    expect(matchState.players.A.board).toEqual([]);
    expect(ctx.queue).toHaveLength(1);
    resolveTriggerQueue(ctx);
    expect(matchState.players.B.heroHealth).toBe(RULES_CONFIG.heroHealth - 2);

    const withoutDeathrattle = unit("doomed-without-deathrattle", {
      health: 0,
    });
    withoutDeathrattle.cardId = doomedDefinition.id;
    const withoutDeathrattleState = state([withoutDeathrattle]);
    const withoutDeathrattleCtx = context(
      withoutDeathrattleState,
      [doomedDefinition],
      source("A", withoutDeathrattle),
    );
    checkStateBasedDeaths(withoutDeathrattleCtx);
    resolveTriggerQueue(withoutDeathrattleCtx);
    expect(withoutDeathrattleState.players.B.heroHealth).toBe(
      RULES_CONFIG.heroHealth,
    );
  });

  it("DIVINE_SHIELD prevents the first damage instance", () => {
    const attacker = unit("attacker", { attack: 3 });
    const shielded = unit("shielded", {
      health: 2,
      keywords: ["DIVINE_SHIELD"],
    });
    const matchState = state([attacker], [shielded]);

    performAttack(
      context(matchState, [], source("A", attacker)),
      attacker.instanceId,
      shielded.instanceId,
    );

    expect(matchState.players.B.board[0]).toMatchObject({
      health: 2,
      keywords: [],
    });
  });

  it("LIFESTEAL heals by actual damage dealt", () => {
    const attacker = unit("drinker", {
      attack: 5,
      keywords: ["LIFESTEAL"],
    });
    const defender = unit("defender", { attack: 0, health: 2 });
    const matchState = state([attacker], [defender]);
    matchState.players.A.heroHealth = 10;

    performAttack(
      context(matchState, [], source("A", attacker)),
      attacker.instanceId,
      defender.instanceId,
    );

    expect(matchState.players.A.heroHealth).toBe(12);
  });

  it("WINDFURY allows exactly two attacks per turn", () => {
    const attacker = unit("twins", {
      attack: 1,
      keywords: ["WINDFURY"],
    });
    const ctx = context(state([attacker]), [], source("A", attacker));

    performAttack(ctx, attacker.instanceId, heroTargetId("B"));
    performAttack(ctx, attacker.instanceId, heroTargetId("B"));

    expect(() =>
      performAttack(ctx, attacker.instanceId, heroTargetId("B")),
    ).toThrow(/attack limit/i);
  });

  it("STEALTH blocks enemy targeted effects and attacks until it attacks", () => {
    const stalker = unit("stalker", { keywords: ["STEALTH"] });
    const enemy = unit("enemy", { attack: 0 });
    const matchState = state([stalker], [enemy]);
    const enemySource = source("B", enemy);

    expect(
      getLegalTargets(matchState, enemySource, "ENEMY_UNIT"),
    ).not.toContain(stalker.instanceId);
    matchState.activeSide = "B";
    expect(() =>
      performAttack(
        context(matchState, [], enemySource),
        enemy.instanceId,
        stalker.instanceId,
      ),
    ).toThrow(/legal attack target/i);

    matchState.activeSide = "A";
    performAttack(
      context(matchState, [], source("A", stalker)),
      stalker.instanceId,
      enemy.instanceId,
    );

    expect(stalker.keywords).not.toContain("STEALTH");
    expect(getLegalTargets(matchState, enemySource, "ENEMY_UNIT")).toContain(
      stalker.instanceId,
    );
  });

  it("POISONOUS destroys a unit only after positive damage; Divine Shield prevention does not poison", () => {
    const venom = unit("venom", { keywords: ["POISONOUS", "WINDFURY"] });
    const shielded = unit("shielded", {
      health: 5,
      keywords: ["DIVINE_SHIELD"],
    });
    const matchState = state([venom], [shielded]);
    const ctx = context(matchState, [], source("A", venom));

    performAttack(ctx, venom.instanceId, shielded.instanceId);

    expect(matchState.players.B.board).toHaveLength(1);
    expect(shielded.health).toBe(5);

    performAttack(ctx, venom.instanceId, shielded.instanceId);

    expect(matchState.players.B.board).toEqual([]);
  });
});

describe("played-card targeting", () => {
  it("resolves an ON_PLAY effect against the selected target", () => {
    const caster = unit("caster", { keywords: ["BATTLECRY"] });
    const firstEnemy = unit("first-enemy");
    const selectedEnemy = unit("selected-enemy");
    const casterDefinition = definition(
      "card-caster",
      ["BATTLECRY"],
      [
        {
          trigger: "ON_PLAY",
          conditions: [],
          effects: [
            { type: "DEAL_DAMAGE", amount: 2, target: "ENEMY_UNIT" },
            { type: "HEAL", amount: 2, target: "FRIENDLY_HERO" },
          ],
        },
      ],
    );
    const matchState = state([caster], [firstEnemy, selectedEnemy]);
    const ctx = context(matchState, [casterDefinition], source("A", caster));
    matchState.players.A.heroHealth = 10;
    ctx.selectedTargetId = selectedEnemy.instanceId;

    enqueueTriggers(ctx, {
      type: "ON_PLAY",
      source: source("A", caster),
      playedFromHand: true,
    });
    resolveTriggerQueue(ctx);

    expect(firstEnemy.health).toBe(3);
    expect(selectedEnemy.health).toBe(1);
    expect(matchState.players.A.heroHealth).toBe(12);
  });

  it("enumerates a legal play whose fixed effects use different selectors", () => {
    const spellId = cardId("card-split-spell");
    const spell: CardDefinition = {
      id: spellId,
      name: "Split Spell",
      type: "SPELL",
      factionId: fireFactionId,
      rarity: "COMMON",
      cost: 1,
      keywords: [],
      triggers: [
        {
          trigger: "ON_PLAY",
          conditions: [],
          effects: [
            { type: "DEAL_DAMAGE", amount: 1, target: "ENEMY_HERO" },
            { type: "HEAL", amount: 1, target: "FRIENDLY_HERO" },
          ],
        },
      ],
    };
    const matchState = state();
    matchState.players.A.mana = 1;
    matchState.players.A.hand.push({
      instanceId: "split-spell-instance",
      cardId: spellId,
    });

    expect(
      enumerateLegalActions(matchState, new Map([[spellId, spell]])),
    ).toContainEqual({
      type: "PLAY_CARD",
      side: "A",
      cardInstanceId: "split-spell-instance",
    });
  });
});
