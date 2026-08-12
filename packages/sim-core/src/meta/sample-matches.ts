import { META_CONFIG } from "@tcgtycoon/balance";
import type {
  DeckGenome,
  DeckId,
  PersistentPlayer,
  PlayerId,
  WorldState,
} from "@tcgtycoon/domain";
import {
  deriveSeed,
  type BattleStrategy,
  type DeterministicRng,
  simulateMatch,
  validateDeck,
} from "@tcgtycoon/rules-engine";
import { playerOwnsGenome } from "../deck-evolution/deck-builder";
import { toDeckDefinition } from "../deck-evolution/deck-genome";

export type SampledMatchResult = {
  sequence: number;
  playerAId: PlayerId;
  playerBId: PlayerId;
  deckAId: DeckId;
  deckBId: DeckId;
  winnerPlayerId: PlayerId;
  winnerDeckId: DeckId;
  loserDeckId: DeckId;
  turns: number;
};

type EligiblePlayer = {
  player: PersistentPlayer;
  decks: DeckGenome[];
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function battleStrategy(
  player: PersistentPlayer,
  deck: DeckGenome,
): BattleStrategy {
  return {
    aggression: clampUnit(deck.strategy.aggression ?? player.motivation.casual),
    value: clampUnit(deck.strategy.value ?? player.motivation.competitive),
    preservation: clampUnit(
      deck.strategy.preservation ?? 1 - player.motivation.brewer,
    ),
  };
}

function eligiblePlayers(world: WorldState): EligiblePlayer[] {
  const cards = Object.values(world.cards);

  return Object.values(world.players)
    .filter((player) => player.activity !== "CHURNED")
    .sort((left, right) => compareIds(left.id, right.id))
    .flatMap((player) => {
      const decks = player.deckIds
        .map((id) => world.decks[id])
        .filter((deck): deck is DeckGenome => deck !== undefined)
        .filter(
          (deck) =>
            playerOwnsGenome(player, world, deck) &&
            validateDeck(toDeckDefinition(deck), cards).valid,
        )
        .sort((left, right) => compareIds(left.id, right.id));
      return decks.length === 0 ? [] : [{ player, decks }];
    });
}

function dailyMatchTarget(eligiblePlayerCount: number): number {
  if (eligiblePlayerCount < 2) {
    return 0;
  }
  if (eligiblePlayerCount >= META_CONFIG.fullWorldMinimumPlayers) {
    return META_CONFIG.fullWorldDailyMatchTarget;
  }
  return eligiblePlayerCount * META_CONFIG.smallWorldMatchesPerEligiblePlayer;
}

export function sampleDailyMatches(
  world: WorldState,
  rng: DeterministicRng,
  deckEligible: (deck: DeckGenome) => boolean = () => true,
): SampledMatchResult[] {
  const eligible = eligiblePlayers(world).flatMap((entry) => {
    const decks = entry.decks.filter(deckEligible);
    return decks.length === 0 ? [] : [{ ...entry, decks }];
  });
  const target = dailyMatchTarget(eligible.length);
  const cards = new Map(
    Object.values(world.cards).map((card) => [card.id, card]),
  );
  const results: SampledMatchResult[] = [];

  for (let sequence = 0; sequence < target; sequence += 1) {
    const playerAIndex = rng.nextInt(eligible.length);
    const opponentOffset = 1 + rng.nextInt(eligible.length - 1);
    const playerBIndex = (playerAIndex + opponentOffset) % eligible.length;
    const playerA = eligible[playerAIndex]!;
    const playerB = eligible[playerBIndex]!;
    const deckA = playerA.decks[rng.nextInt(playerA.decks.length)]!;
    const deckB = playerB.decks[rng.nextInt(playerB.decks.length)]!;
    const matchSeed = deriveSeed([
      world.worldSeed,
      world.day,
      "daily-match",
      sequence,
      rng.nextUint64().toString(),
    ]);
    const match = simulateMatch({
      seed: matchSeed,
      deckA: toDeckDefinition(deckA),
      deckB: toDeckDefinition(deckB),
      cards,
      strategyA: battleStrategy(playerA.player, deckA),
      strategyB: battleStrategy(playerB.player, deckB),
    });
    const winnerIsA = match.winner === "A";

    results.push({
      sequence,
      playerAId: playerA.player.id,
      playerBId: playerB.player.id,
      deckAId: deckA.id,
      deckBId: deckB.id,
      winnerPlayerId: winnerIsA ? playerA.player.id : playerB.player.id,
      winnerDeckId: winnerIsA ? deckA.id : deckB.id,
      loserDeckId: winnerIsA ? deckB.id : deckA.id,
      turns: match.turns,
    });
  }

  return results;
}
