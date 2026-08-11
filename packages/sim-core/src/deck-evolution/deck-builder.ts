import { DECK_EVOLUTION_CONFIG, RULES_CONFIG } from "@tcgtycoon/balance";
import {
  deckId,
  type CardDefinition,
  type CardId,
  type DeckCardEntry,
  type DeckGenome,
  type FactionId,
  type PersistentPlayer,
  type StrategyVector,
  type WorldState,
} from "@tcgtycoon/domain";
import { type DeterministicRng, validateDeck } from "@tcgtycoon/rules-engine";
import { updateKnowledgeFromOwnedCards } from "../society/knowledge";
import { createChildGenome, toDeckDefinition } from "./deck-genome";

const NEUTRAL_FACTION_ID = "neutral";

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function ownedCardCounts(
  player: PersistentPlayer,
  world: WorldState,
): Map<CardId, number> {
  const counts = new Map<CardId, number>();
  for (const [printingId, quantity] of Object.entries(player.collection).sort(
    ([left], [right]) => compareIds(left, right),
  )) {
    const printing = world.printings[printingId];
    if (printing === undefined || quantity <= 0) {
      continue;
    }
    counts.set(printing.cardId, (counts.get(printing.cardId) ?? 0) + quantity);
  }
  return counts;
}

export function playerOwnsGenome(
  player: PersistentPlayer,
  world: WorldState,
  genome: DeckGenome,
): boolean {
  const owned = ownedCardCounts(player, world);
  return genome.cards.every(
    (entry) => (owned.get(entry.cardId) ?? 0) >= entry.count,
  );
}

function effectCount(card: CardDefinition): number {
  return card.triggers.reduce(
    (total, trigger) => total + trigger.effects.length,
    0,
  );
}

function cardHeuristic(card: CardDefinition, player: PersistentPlayer): number {
  const stats = card.type === "UNIT" ? card.attack + card.health : 0;
  const efficiency = (stats + effectCount(card)) / (card.cost + 1);
  const synergy =
    card.keywords.length + card.triggers.length + effectCount(card);
  const casualValue = stats + card.keywords.length;
  return (
    player.motivation.competitive * efficiency +
    player.motivation.brewer * synergy +
    player.motivation.casual * casualValue
  );
}

function strategyForPlayer(player: PersistentPlayer): StrategyVector {
  return {
    competitive: player.motivation.competitive,
    brewer: player.motivation.brewer,
    casual: player.motivation.casual,
    collector: player.motivation.collector,
  };
}

function buildEntries(
  pool: readonly CardDefinition[],
  owned: ReadonlyMap<CardId, number>,
  player: PersistentPlayer,
  rng: DeterministicRng,
): DeckCardEntry[] | undefined {
  const scored = pool
    .map((card) => ({
      card,
      score:
        cardHeuristic(card, player) +
        rng.nextFloat() * DECK_EVOLUTION_CONFIG.candidateRandomness,
    }))
    .sort(
      (left, right) =>
        right.score - left.score || compareIds(left.card.id, right.card.id),
    );
  const entries: DeckCardEntry[] = [];
  let remaining: number = RULES_CONFIG.deckSize;

  for (const { card } of scored) {
    if (remaining === 0) {
      break;
    }
    const count = Math.min(
      Math.floor(owned.get(card.id) ?? 0),
      RULES_CONFIG.normalCopyLimit,
      remaining,
    );
    if (count !== 1 && count !== 2) {
      continue;
    }
    entries.push({ cardId: card.id, count });
    remaining -= count;
  }

  return remaining === 0
    ? entries.sort((left, right) => compareIds(left.cardId, right.cardId))
    : undefined;
}

export function generateCandidateDecks(
  player: PersistentPlayer,
  world: WorldState,
  rng: DeterministicRng,
): DeckGenome[] {
  updateKnowledgeFromOwnedCards(player, world);
  const known = new Set(player.knowledge.knownCardIds);
  const owned = ownedCardCounts(player, world);
  const ownedKnownCards = [...owned.keys()]
    .filter((id) => known.has(id) && world.cards[id] !== undefined)
    .map((id) => world.cards[id]!)
    .sort((left, right) => compareIds(left.id, right.id));
  const factions = [
    ...new Set(
      ownedKnownCards
        .map((card) => card.factionId)
        .filter((id) => id !== NEUTRAL_FACTION_ID),
    ),
  ].sort(compareIds) as FactionId[];
  const candidates: DeckGenome[] = [];

  for (const factionId of factions) {
    const pool = ownedKnownCards.filter(
      (card) =>
        card.factionId === factionId || card.factionId === NEUTRAL_FACTION_ID,
    );
    const cards = buildEntries(pool, owned, player, rng);
    if (cards === undefined) {
      continue;
    }

    const genome: DeckGenome = {
      id: deckId(`deck-${player.id}-day-${world.day}-${factionId}-candidate`),
      factionId,
      cards,
      strategy: strategyForPlayer(player),
      originPlayerId: player.id,
      parentDeckIds: [],
      generation: 0,
      createdDay: world.day,
    };
    if (
      playerOwnsGenome(player, world, genome) &&
      validateDeck(toDeckDefinition(genome), Object.values(world.cards)).valid
    ) {
      candidates.push(genome);
    }
  }

  return candidates;
}

function mutationId(parent: DeckGenome, rng: DeterministicRng) {
  const nonce = rng.nextUint64().toString(16).padStart(16, "0");
  return deckId(`${parent.id}-g${parent.generation + 1}-${nonce}`);
}

export function mutateDeck(
  parent: DeckGenome,
  player: PersistentPlayer,
  world: WorldState,
  rng: DeterministicRng,
): DeckGenome {
  updateKnowledgeFromOwnedCards(player, world);
  const parentIsLegal = validateDeck(
    toDeckDefinition(parent),
    Object.values(world.cards),
  ).valid;
  if (!playerOwnsGenome(player, world, parent) || !parentIsLegal) {
    const rebuilt = generateCandidateDecks(player, world, rng).find(
      (candidate) => candidate.factionId === parent.factionId,
    );
    if (rebuilt === undefined) {
      throw new Error(
        `Player ${player.id} cannot rebuild an owned legal ${parent.factionId} deck`,
      );
    }
    return createChildGenome(
      parent,
      mutationId(parent, rng),
      rebuilt.cards,
      rebuilt.strategy,
      world.day,
    );
  }

  const owned = ownedCardCounts(player, world);
  const known = new Set(player.knowledge.knownCardIds);
  const parentCardIds = new Set(parent.cards.map((entry) => entry.cardId));
  const alternatives = [...owned.keys()]
    .filter((cardId) => {
      const card = world.cards[cardId];
      return (
        card !== undefined &&
        known.has(cardId) &&
        !parentCardIds.has(cardId) &&
        (card.factionId === parent.factionId ||
          card.factionId === NEUTRAL_FACTION_ID)
      );
    })
    .sort(compareIds);
  const cards = parent.cards.map((entry) => ({ ...entry }));

  for (
    let replacement = 0;
    replacement < DECK_EVOLUTION_CONFIG.maxMutationReplacements;
    replacement += 1
  ) {
    const replaceable = cards
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) =>
        alternatives.some((cardId) => (owned.get(cardId) ?? 0) >= entry.count),
      );
    if (replaceable.length === 0 || alternatives.length === 0) {
      break;
    }
    const selected = replaceable[rng.nextInt(replaceable.length)]!;
    const eligibleAlternatives = alternatives.filter(
      (cardId) => (owned.get(cardId) ?? 0) >= selected.entry.count,
    );
    const alternative =
      eligibleAlternatives[rng.nextInt(eligibleAlternatives.length)]!;
    cards[selected.index] = {
      cardId: alternative,
      count: selected.entry.count,
    };
    alternatives.splice(alternatives.indexOf(alternative), 1);
  }

  const sortedCards = cards.sort((left, right) =>
    compareIds(left.cardId, right.cardId),
  );
  const child = createChildGenome(
    parent,
    mutationId(parent, rng),
    sortedCards,
    strategyForPlayer(player),
    world.day,
  );
  if (
    playerOwnsGenome(player, world, child) &&
    validateDeck(toDeckDefinition(child), Object.values(world.cards)).valid
  ) {
    return child;
  }

  return createChildGenome(
    parent,
    mutationId(parent, rng),
    parent.cards,
    parent.strategy,
    world.day,
  );
}
