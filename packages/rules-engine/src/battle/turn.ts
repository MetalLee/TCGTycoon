import { RULES_CONFIG } from "@tcgtycoon/balance";
import type { CardId } from "@tcgtycoon/domain";
import type { CardInstance, MatchSide, MatchState } from "./types";

export type DrawCardResult =
  | { type: "DRAWN"; card: CardInstance }
  | { type: "BURNED"; card: CardInstance }
  | { type: "FATIGUE"; damage: number };

function createCardInstance(state: MatchState, cardId: CardId): CardInstance {
  const sequence = state.nextInstanceSequence++;
  return {
    instanceId: `${state.matchId}:card:${sequence}`,
    cardId,
  };
}

export function drawCard(state: MatchState, side: MatchSide): DrawCardResult {
  const player = state.players[side];
  const cardId = player.deck.pop();

  if (cardId === undefined) {
    const damage = ++player.fatigue;
    player.heroHealth = Math.max(0, player.heroHealth - damage);
    state.actionLog.push({
      sequence: state.nextLogSequence++,
      turn: state.turnNumber,
      side,
      type: "FATIGUE_DAMAGE",
      amount: damage,
    });

    if (player.heroHealth === 0) {
      state.winner = side === "A" ? "B" : "A";
    }

    return { type: "FATIGUE", damage };
  }

  const card = createCardInstance(state, cardId);

  if (player.hand.length >= RULES_CONFIG.handLimit) {
    player.discard.push(card);
    state.actionLog.push({
      sequence: state.nextLogSequence++,
      turn: state.turnNumber,
      side,
      type: "CARD_BURNED",
      cardId,
      instanceId: card.instanceId,
    });
    return { type: "BURNED", card };
  }

  player.hand.push(card);
  state.actionLog.push({
    sequence: state.nextLogSequence++,
    turn: state.turnNumber,
    side,
    type: "CARD_DRAWN",
    cardId,
    instanceId: card.instanceId,
  });
  return { type: "DRAWN", card };
}

export function startTurn(
  state: MatchState,
  resolveStartOfTurnTriggers?: () => void,
): void {
  state.turnNumber += 1;
  resolveStartOfTurnTriggers?.();
  if (state.winner !== null) {
    return;
  }

  const side = state.activeSide;
  const player = state.players[side];
  player.maxMana = Math.min(RULES_CONFIG.maxMana, player.maxMana + 1);
  player.mana = player.maxMana;
  state.actionLog.push({
    sequence: state.nextLogSequence++,
    turn: state.turnNumber,
    side,
    type: "TURN_STARTED",
    maxMana: player.maxMana,
  });
  drawCard(state, side);
}

export function endTurn(state: MatchState): void {
  const side = state.activeSide;
  state.actionLog.push({
    sequence: state.nextLogSequence++,
    turn: state.turnNumber,
    side,
    type: "TURN_ENDED",
  });
  state.activeSide = side === "A" ? "B" : "A";
}
