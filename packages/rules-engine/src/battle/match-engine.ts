import { RULES_CONFIG } from "@tcgtycoon/balance";
import type { CardDefinition, CardId, DeckDefinition } from "@tcgtycoon/domain";
import {
  chooseBattleAction,
  chooseMulliganCards,
  type BattleStrategy,
} from "../ai/battle-ai";
import { checkStateBasedDeaths, performAttack } from "./state-check";
import {
  COIN_CARD_ID,
  createMatchState,
  mulliganCards,
} from "./create-match-state";
import type { EffectSource } from "./targeting";
import {
  enqueueTriggers,
  resolveTriggerQueue,
  type MatchWarning,
  type ResolutionContext,
} from "./triggers";
import { endTurn, startTurn } from "./turn";
import type {
  ActionLogEntry,
  BattleAction,
  CardInstance,
  MatchSide,
  MatchState,
  UnitInstance,
} from "./types";

export type { BattleStrategy } from "../ai/battle-ai";

export type MatchInput = {
  seed: bigint;
  deckA: DeckDefinition;
  deckB: DeckDefinition;
  cards: ReadonlyMap<CardId, CardDefinition>;
  strategyA: BattleStrategy;
  strategyB: BattleStrategy;
  recordActionLog?: boolean;
};

export type MatchPlayerStatistics = {
  cardsPlayed: number;
  unitsPlayed: number;
  spellsPlayed: number;
  attacks: number;
};

export type MatchStatistics = {
  A: MatchPlayerStatistics;
  B: MatchPlayerStatistics;
};

export type MatchResult = {
  winner: "A" | "B";
  turns: number;
  actionCount: number;
  warnings: MatchWarning[];
  statistics: MatchStatistics;
  actionLog?: ActionLogEntry[];
};

const MATCH_TURN_GUARD = 200;

function emptyPlayerStatistics(): MatchPlayerStatistics {
  return {
    cardsPlayed: 0,
    unitsPlayed: 0,
    spellsPlayed: 0,
    attacks: 0,
  };
}

function appendMainPhaseActionWarning(warnings: MatchWarning[]): void {
  if (
    warnings.some(
      (warning) =>
        warning.code === "POTENTIAL_INFINITE_COMBO" &&
        warning.limit === "ACTIONS",
    )
  ) {
    return;
  }

  warnings.push({
    code: "POTENTIAL_INFINITE_COMBO",
    message: `Main phase stopped after reaching the ${RULES_CONFIG.maxActionsPerChain}-action safety limit.`,
    limit: "ACTIONS",
  });
}

function validateStrategy(strategy: BattleStrategy, side: MatchSide): void {
  for (const [name, value] of Object.entries(strategy)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(
        `Strategy ${side} ${name} must be a finite number from 0 to 1.`,
      );
    }
  }
}

function resolutionContext(
  state: MatchState,
  cards: ReadonlyMap<CardId, CardDefinition>,
  source: EffectSource,
  warnings: MatchWarning[],
  selectedTargetId?: string,
): ResolutionContext {
  return {
    state,
    cardDefinitions: cards,
    queue: [],
    actionCount: 0,
    triggerDepth: 0,
    summonsThisChain: 0,
    warnings,
    source,
    ...(selectedTargetId === undefined ? {} : { selectedTargetId }),
  };
}

function playCoin(
  state: MatchState,
  side: MatchSide,
  card: CardInstance,
): void {
  const player = state.players[side];
  player.hand.splice(player.hand.indexOf(card), 1);
  player.discard.push(card);
  player.mana += 1;
}

function unitFromCard(
  state: MatchState,
  card: CardInstance,
  definition: Extract<CardDefinition, { type: "UNIT" }>,
): UnitInstance {
  return {
    ...card,
    attack: definition.attack,
    health: definition.health,
    maxHealth: definition.health,
    keywords: [...definition.keywords],
    summonedTurn: state.turnNumber,
    attacksThisTurn: 0,
    lastAttackTurn: state.turnNumber,
  };
}

function playCard(
  state: MatchState,
  action: Extract<BattleAction, { type: "PLAY_CARD" }>,
  cards: ReadonlyMap<CardId, CardDefinition>,
  warnings: MatchWarning[],
): CardDefinition | null {
  if (action.side !== state.activeSide) {
    throw new RangeError(`Side ${action.side} is not the active side.`);
  }

  const player = state.players[action.side];
  const card = player.hand.find(
    (candidate) => candidate.instanceId === action.cardInstanceId,
  );
  if (card === undefined) {
    throw new RangeError(`Card ${action.cardInstanceId} is not in hand.`);
  }
  if (card.cardId === COIN_CARD_ID) {
    playCoin(state, action.side, card);
    return null;
  }

  const definition = cards.get(card.cardId);
  if (definition === undefined) {
    throw new RangeError(`Card definition ${card.cardId} does not exist.`);
  }
  if (definition.cost > player.mana) {
    throw new RangeError(`Card ${card.cardId} is not affordable.`);
  }

  player.hand.splice(player.hand.indexOf(card), 1);
  player.mana -= definition.cost;

  if (definition.type === "UNIT") {
    player.board.push(unitFromCard(state, card, definition));
  } else {
    player.discard.push(card);
  }

  const source: EffectSource = {
    side: action.side,
    instanceId: card.instanceId,
    cardId: card.cardId,
  };
  const ctx = resolutionContext(
    state,
    cards,
    source,
    warnings,
    action.targetId,
  );
  enqueueTriggers(ctx, { type: "ON_PLAY", source, playedFromHand: true });
  resolveTriggerQueue(ctx);
  checkStateBasedDeaths(ctx);

  if (definition.type === "SPELL") {
    enqueueTriggers(ctx, { type: "AFTER_SPELL_PLAYED", source });
    resolveTriggerQueue(ctx);
    checkStateBasedDeaths(ctx);
  }
  return definition;
}

function resolveTurnEvent(
  state: MatchState,
  cards: ReadonlyMap<CardId, CardDefinition>,
  warnings: MatchWarning[],
  type: "TURN_START" | "TURN_END",
): void {
  const side = state.activeSide;
  const source: EffectSource = {
    side,
    instanceId: `hero:${side}`,
    cardId: COIN_CARD_ID,
  };
  const ctx = resolutionContext(state, cards, source, warnings);
  enqueueTriggers(ctx, { type, side });
  resolveTriggerQueue(ctx);
  checkStateBasedDeaths(ctx);
}

function executeAction(
  state: MatchState,
  action: BattleAction,
  cards: ReadonlyMap<CardId, CardDefinition>,
  warnings: MatchWarning[],
  statistics: MatchStatistics,
): boolean {
  const side = action.side;

  switch (action.type) {
    case "PLAY_CARD": {
      const definition = playCard(state, action, cards, warnings);
      statistics[side].cardsPlayed += 1;
      if (definition?.type === "UNIT") {
        statistics[side].unitsPlayed += 1;
      } else if (definition?.type === "SPELL") {
        statistics[side].spellsPlayed += 1;
      }
      break;
    }
    case "ATTACK": {
      const attacker = state.players[side].board.find(
        (unit) => unit.instanceId === action.attackerId,
      );
      if (attacker === undefined) {
        throw new RangeError(`Attacker ${action.attackerId} does not exist.`);
      }
      const ctx = resolutionContext(
        state,
        cards,
        {
          side,
          instanceId: attacker.instanceId,
          cardId: attacker.cardId,
        },
        warnings,
      );
      performAttack(ctx, action.attackerId, action.targetId);
      statistics[side].attacks += 1;
      break;
    }
    case "END_TURN":
      resolveTurnEvent(state, cards, warnings, "TURN_END");
      if (state.winner === null) {
        endTurn(state);
      }
      return true;
  }
  return false;
}

export function simulateMatch(input: MatchInput): MatchResult {
  validateStrategy(input.strategyA, "A");
  validateStrategy(input.strategyB, "B");

  const state = createMatchState(input);
  const warnings: MatchWarning[] = [];
  const statistics: MatchStatistics = {
    A: emptyPlayerStatistics(),
    B: emptyPlayerStatistics(),
  };
  let actionCount = 0;

  mulliganCards(
    state,
    "A",
    chooseMulliganCards(state, "A", input.cards, input.strategyA),
  );
  mulliganCards(
    state,
    "B",
    chooseMulliganCards(state, "B", input.cards, input.strategyB),
  );

  while (state.winner === null) {
    if (state.turnNumber >= MATCH_TURN_GUARD) {
      throw new Error(
        `Match exceeded the ${MATCH_TURN_GUARD}-turn engine safety guard.`,
      );
    }

    startTurn(state, () => {
      resolveTurnEvent(state, input.cards, warnings, "TURN_START");
    });
    if (state.winner !== null) {
      break;
    }

    const strategy =
      state.activeSide === "A" ? input.strategyA : input.strategyB;
    let turnEnded = false;
    let turnActionCount = 0;
    while (!turnEnded && state.winner === null) {
      if (turnActionCount >= RULES_CONFIG.maxActionsPerChain) {
        appendMainPhaseActionWarning(warnings);
        executeAction(
          state,
          { type: "END_TURN", side: state.activeSide },
          input.cards,
          warnings,
          statistics,
        );
        turnEnded = true;
        break;
      }

      const action = chooseBattleAction({
        state,
        cards: input.cards,
        strategy,
        decisionSequence: actionCount,
      });
      actionCount += 1;
      turnActionCount += 1;
      turnEnded = executeAction(
        state,
        action,
        input.cards,
        warnings,
        statistics,
      );
    }
  }

  if (state.winner === null) {
    throw new Error("Match ended without a winner.");
  }

  return {
    winner: state.winner,
    turns: state.turnNumber,
    actionCount,
    warnings,
    statistics,
    ...(input.recordActionLog ? { actionLog: state.actionLog } : {}),
  };
}
