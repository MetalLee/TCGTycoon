import { RULES_CONFIG } from "@tcgtycoon/balance";
import {
  cardId,
  matchId,
  type CardDefinition,
  type CardId,
  type DeckDefinition,
} from "@tcgtycoon/domain";
import { DeterministicRng, deriveSeed } from "../rng/deterministic-rng";
import { validateCardDefinition } from "../validation/card-validation";
import { validateDeck } from "../validation/deck-validation";
import { drawCard } from "./turn";
import type {
  CardInstance,
  MatchPlayerState,
  MatchSide,
  MatchState,
} from "./types";

export const COIN_CARD_ID = cardId("special-coin");

export type CreateMatchStateInput = {
  seed: bigint;
  deckA: DeckDefinition;
  deckB: DeckDefinition;
  cards: ReadonlyMap<CardId, CardDefinition>;
};

function expandDeck(deck: DeckDefinition): CardId[] {
  return deck.cards.flatMap((entry) =>
    Array.from({ length: entry.count }, () => entry.cardId),
  );
}

function shuffle<T>(values: T[], rng: DeterministicRng): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const otherIndex = rng.nextInt(index + 1);
    [values[index], values[otherIndex]] = [values[otherIndex]!, values[index]!];
  }
}

function shuffledDeck(
  deck: DeckDefinition,
  seed: bigint,
  side: MatchSide,
): CardId[] {
  const cards = expandDeck(deck);
  const rng = new DeterministicRng(
    deriveSeed(["match-deck", seed.toString(), side]),
  );
  shuffle(cards, rng);
  return cards;
}

function createPlayerState(deck: CardId[]): MatchPlayerState {
  return {
    heroHealth: RULES_CONFIG.heroHealth,
    deck,
    hand: [],
    board: [],
    discard: [],
    maxMana: 0,
    mana: 0,
    fatigue: 0,
  };
}

function assertLegalDeck(
  deck: DeckDefinition,
  cards: readonly CardDefinition[],
): void {
  const validation = validateDeck(deck, cards);
  if (!validation.valid) {
    const codes = validation.issues.map((issue) => issue.code).join(", ");
    throw new RangeError(
      `Cannot create match with invalid deck ${deck.id}: ${codes}`,
    );
  }
}

function assertLegalCardPool(
  cards: ReadonlyMap<CardId, CardDefinition>,
): void {
  for (const [mapCardId, definition] of cards) {
    const validation = validateCardDefinition(definition);
    if (!validation.valid) {
      const details = validation.issues
        .map((issue) => issue.message)
        .join("; ");
      throw new RangeError(
        `Invalid card definition ${definition.id}: ${details}`,
      );
    }
    if (mapCardId !== definition.id) {
      throw new RangeError(
        `Card map key ${mapCardId} does not match definition ${definition.id}.`,
      );
    }
  }

  for (const definition of cards.values()) {
    for (const trigger of definition.triggers) {
      for (const effect of trigger.effects) {
        if (effect.type === "CREATE_CARD" && !cards.has(effect.cardId)) {
          throw new RangeError(
            `Card ${definition.id} references missing card definition ${effect.cardId}.`,
          );
        }
        if (effect.type === "SUMMON") {
          const tokenDefinition = cards.get(effect.tokenCardId);
          if (tokenDefinition === undefined) {
            throw new RangeError(
              `Card ${definition.id} references missing card definition ${effect.tokenCardId}.`,
            );
          }
          if (tokenDefinition.type !== "UNIT") {
            throw new RangeError(
              `Card ${definition.id} cannot summon non-Unit card ${effect.tokenCardId}.`,
            );
          }
        }
      }
    }
  }
}

function createCoin(state: MatchState): CardInstance {
  const sequence = state.nextInstanceSequence++;
  return {
    instanceId: `${state.matchId}:card:${sequence}`,
    cardId: COIN_CARD_ID,
  };
}

export function createMatchState(input: CreateMatchStateInput): MatchState {
  assertLegalCardPool(input.cards);
  const cardDefinitions = [...input.cards.values()];
  assertLegalDeck(input.deckA, cardDefinitions);
  assertLegalDeck(input.deckB, cardDefinitions);

  const stableMatchId = matchId(
    `match-${deriveSeed(["match-id", input.seed.toString()]).toString(16)}`,
  );
  const state: MatchState = {
    matchId: stableMatchId,
    matchSeed: input.seed,
    turnNumber: 0,
    activeSide: "A",
    players: {
      A: createPlayerState(shuffledDeck(input.deckA, input.seed, "A")),
      B: createPlayerState(shuffledDeck(input.deckB, input.seed, "B")),
    },
    actionLog: [],
    winner: null,
    mulliganCompleted: { A: false, B: false },
    nextInstanceSequence: 0,
    nextLogSequence: 0,
  };

  for (let index = 0; index < 3; index += 1) {
    drawCard(state, "A");
  }
  for (let index = 0; index < 4; index += 1) {
    drawCard(state, "B");
  }

  const coin = createCoin(state);
  state.players.B.hand.push(coin);
  state.actionLog.push({
    sequence: state.nextLogSequence++,
    turn: state.turnNumber,
    side: "B",
    type: "COIN_ADDED",
    cardId: coin.cardId,
    instanceId: coin.instanceId,
  });

  return state;
}

export function mulliganCards(
  state: MatchState,
  side: MatchSide,
  returnedInstanceIds: readonly string[],
): void {
  if (state.turnNumber !== 0 || state.mulliganCompleted[side]) {
    throw new Error(`Mulligan is already complete for side ${side}.`);
  }

  const requestedIds = new Set(returnedInstanceIds);
  const player = state.players[side];
  const returnedCards = player.hand.filter((card) =>
    requestedIds.has(card.instanceId),
  );

  if (returnedCards.length !== requestedIds.size) {
    throw new RangeError(
      "Mulligan references a card outside the player's hand.",
    );
  }
  if (returnedCards.some((card) => card.cardId === COIN_CARD_ID)) {
    throw new RangeError("The Coin cannot be returned during mulligan.");
  }

  player.hand = player.hand.filter(
    (card) => !requestedIds.has(card.instanceId),
  );
  const keptCardCount = player.hand.length;

  for (let index = 0; index < returnedCards.length; index += 1) {
    drawCard(state, side);
  }

  const replacementCardIds = player.hand
    .slice(keptCardCount)
    .map((card) => card.cardId);
  const returnedCardIds = returnedCards.map((card) => card.cardId);
  player.deck.push(...returnedCardIds);
  shuffle(
    player.deck,
    new DeterministicRng(
      deriveSeed(["mulligan", state.matchSeed.toString(), side]),
    ),
  );
  state.mulliganCompleted[side] = true;
  state.actionLog.push({
    sequence: state.nextLogSequence++,
    turn: state.turnNumber,
    side,
    type: "MULLIGAN",
    returnedCardIds,
    replacementCardIds,
  });
}
