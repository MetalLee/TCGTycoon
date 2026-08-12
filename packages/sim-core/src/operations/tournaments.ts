import {
  TOURNAMENT_CONFIG,
  TOURNAMENT_PUBLICITY_CONFIG,
  type TournamentPresetConfig,
} from "@tcgtycoon/balance";
import {
  matchId,
  type CardId,
  type DeckGenome,
  type DeckId,
  type MatchId,
  type PlayerId,
  type TournamentId,
  type TournamentPreset,
  type TournamentSchedule,
  type WorldState,
} from "@tcgtycoon/domain";
import {
  DeterministicRng,
  deriveSeed,
  simulateMatch,
  type BattleStrategy,
  type MatchReplay,
} from "@tcgtycoon/rules-engine";
import { playerOwnsGenome } from "../deck-evolution/deck-builder";
import { toDeckDefinition } from "../deck-evolution/deck-genome";
import { recordKnowledgeExposure } from "../society/knowledge";
import { validateDeckForBanlist, type BanlistVersion } from "./policies";

export type TournamentEntrant = {
  playerId: PlayerId;
  deckId: DeckId;
  skill: number;
};

export type TournamentRegistration = {
  tournamentId: TournamentId;
  name: string;
  preset: TournamentPreset;
  eventDay: number;
  banlistVersionId: string;
  ruleVersion: string;
  entrants: TournamentEntrant[];
};

export type TournamentMatchResult = {
  id: MatchId;
  round: number;
  sequence: number;
  playerAId: PlayerId;
  playerBId: PlayerId;
  deckAId: DeckId;
  deckBId: DeckId;
  winnerPlayerId: PlayerId;
  winnerDeckId: DeckId;
  loserPlayerId: PlayerId;
  loserDeckId: DeckId;
  turns: number;
  isFinal: boolean;
  isNotableUpset: boolean;
  banlistVersionId: string;
  ruleVersion: string;
  replay?: MatchReplay;
};

export type TournamentRoundResult = {
  round: number;
  matchIds: MatchId[];
  byePlayerIds: PlayerId[];
};

export type TournamentPlacement = {
  placement: number;
  playerId: PlayerId;
  deckId: DeckId;
};

export type TournamentPublicKnowledgeEvent = {
  type: "TOURNAMENT_DECKLIST_PUBLIC";
  tournamentId: TournamentId;
  day: number;
  playerId: PlayerId;
  deckId: DeckId;
  placement: number;
  cardIds: CardId[];
  recipientPlayerIds: PlayerId[];
};

export type TournamentAttentionEvent = {
  type: "TOURNAMENT_ATTENTION";
  tournamentId: TournamentId;
  day: number;
  preset: TournamentPreset;
  playerId: PlayerId;
  deckId: DeckId;
  placement: number;
  socialExposure: number;
  tournamentPrestige: number;
};

export type TournamentResult = {
  tournamentId: TournamentId;
  name: string;
  preset: TournamentPreset;
  eventDay: number;
  banlistVersionId: string;
  ruleVersion: string;
  rounds: TournamentRoundResult[];
  matches: TournamentMatchResult[];
  top8: TournamentPlacement[];
  winner: TournamentPlacement;
  publicKnowledgeEvents: TournamentPublicKnowledgeEvent[];
  attentionEvents: TournamentAttentionEvent[];
};

type EliminatedEntrant = {
  entrant: TournamentEntrant;
  round: number;
  sequence: number;
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function requireSchedule(
  schedule: TournamentSchedule,
  config: TournamentPresetConfig,
): void {
  if (!Number.isInteger(schedule.createdDay) || schedule.createdDay < 0) {
    throw new RangeError(
      "Tournament createdDay must be a non-negative integer",
    );
  }
  if (!Number.isInteger(schedule.eventDay) || schedule.eventDay < 0) {
    throw new RangeError("Tournament eventDay must be a non-negative integer");
  }
  if (schedule.eventDay - schedule.createdDay < config.prepDays) {
    throw new RangeError(
      `${schedule.preset} tournaments require ${config.prepDays} preparation days`,
    );
  }
}

function eligibleDecks(
  world: WorldState,
  playerId: PlayerId,
  banlist: BanlistVersion,
  deckEligible: (deck: DeckGenome) => boolean,
): DeckGenome[] {
  const player = world.players[playerId];
  if (player === undefined || player.activity === "CHURNED") {
    return [];
  }
  const cards = Object.values(world.cards);
  return [...new Set(player.deckIds)].sort(compareIds).flatMap((id) => {
    const deck = world.decks[id];
    if (
      deck === undefined ||
      !playerOwnsGenome(player, world, deck) ||
      !deckEligible(deck) ||
      !validateDeckForBanlist(toDeckDefinition(deck), cards, banlist).valid
    ) {
      return [];
    }
    return [deck];
  });
}

export function registerTournamentEntrants(
  world: WorldState,
  schedule: TournamentSchedule,
  banlist: BanlistVersion,
  deckEligible: (deck: DeckGenome) => boolean = () => true,
  config: Readonly<
    Record<TournamentPreset, TournamentPresetConfig>
  > = TOURNAMENT_CONFIG,
): TournamentRegistration {
  const presetConfig = config[schedule.preset];
  requireSchedule(schedule, presetConfig);
  if (banlist.effectiveDay > schedule.eventDay) {
    throw new RangeError(
      `Banlist ${banlist.id} is not active on tournament day ${schedule.eventDay}`,
    );
  }
  const entrants = Object.values(world.players)
    .sort((left, right) => compareIds(left.id, right.id))
    .flatMap((player) => {
      const deck = eligibleDecks(world, player.id, banlist, deckEligible)[0];
      return deck === undefined
        ? []
        : [{ playerId: player.id, deckId: deck.id, skill: player.skill }];
    })
    .slice(0, presetConfig.maxPlayers);

  return {
    tournamentId: schedule.id,
    name: schedule.name,
    preset: schedule.preset,
    eventDay: schedule.eventDay,
    banlistVersionId: banlist.id,
    ruleVersion: world.ruleVersion,
    entrants,
  };
}

function seededPairingOrder(
  entrants: readonly TournamentEntrant[],
  worldSeed: string,
  tournamentId: TournamentId,
): TournamentEntrant[] {
  const ordered = [...entrants].sort((left, right) =>
    compareIds(left.playerId, right.playerId),
  );
  const rng = new DeterministicRng(
    deriveSeed([worldSeed, tournamentId, "tournament-pairings"]),
  );
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const otherIndex = rng.nextInt(index + 1);
    [ordered[index], ordered[otherIndex]] = [
      ordered[otherIndex]!,
      ordered[index]!,
    ];
  }
  return ordered;
}

function battleStrategy(
  world: WorldState,
  entrant: TournamentEntrant,
): BattleStrategy {
  const player = world.players[entrant.playerId]!;
  const deck = world.decks[entrant.deckId]!;
  return {
    aggression: clampUnit(
      deck.strategy.aggression ?? player.motivation.competitive,
    ),
    value: clampUnit(deck.strategy.value ?? player.motivation.casual),
    preservation: clampUnit(
      deck.strategy.preservation ?? 1 - player.motivation.brewer,
    ),
  };
}

function requireEntrantState(
  world: WorldState,
  registration: TournamentRegistration,
): void {
  for (const entrant of registration.entrants) {
    if (world.players[entrant.playerId] === undefined) {
      throw new Error(`Unknown tournament Player ${entrant.playerId}`);
    }
    if (world.decks[entrant.deckId] === undefined) {
      throw new Error(`Unknown tournament Deck ${entrant.deckId}`);
    }
  }
}

function placementOrder(
  winner: TournamentEntrant,
  eliminated: readonly EliminatedEntrant[],
): TournamentPlacement[] {
  const orderedEliminated = [...eliminated].sort(
    (left, right) =>
      right.round - left.round ||
      left.sequence - right.sequence ||
      compareIds(left.entrant.playerId, right.entrant.playerId),
  );
  return [winner, ...orderedEliminated.map(({ entrant }) => entrant)].map(
    (entrant, index) => ({
      placement: index + 1,
      playerId: entrant.playerId,
      deckId: entrant.deckId,
    }),
  );
}

function publishTopDecks(
  world: WorldState,
  registration: TournamentRegistration,
  top8: readonly TournamentPlacement[],
): {
  publicKnowledgeEvents: TournamentPublicKnowledgeEvent[];
  attentionEvents: TournamentAttentionEvent[];
} {
  const recipients = Object.values(world.players)
    .filter((player) => player.activity !== "CHURNED")
    .sort((left, right) => compareIds(left.id, right.id));
  const publicity = TOURNAMENT_PUBLICITY_CONFIG.byPreset[registration.preset];
  const publicKnowledgeEvents: TournamentPublicKnowledgeEvent[] = [];
  const attentionEvents: TournamentAttentionEvent[] = [];
  const publishedDeckIds = new Set<DeckId>();

  for (const placement of top8) {
    if (publishedDeckIds.has(placement.deckId)) {
      continue;
    }
    publishedDeckIds.add(placement.deckId);
    const deck = world.decks[placement.deckId]!;
    const cardIds = [...new Set(deck.cards.map((entry) => entry.cardId))].sort(
      compareIds,
    );
    for (const recipient of recipients) {
      recordKnowledgeExposure(recipient, {
        source: "PUBLIC_EVENT",
        cardIds,
        deckIds: [deck.id],
      });
    }
    publicKnowledgeEvents.push({
      type: "TOURNAMENT_DECKLIST_PUBLIC",
      tournamentId: registration.tournamentId,
      day: registration.eventDay,
      playerId: placement.playerId,
      deckId: placement.deckId,
      placement: placement.placement,
      cardIds,
      recipientPlayerIds: recipients.map((recipient) => recipient.id),
    });
    const placementMultiplier = Math.max(
      TOURNAMENT_PUBLICITY_CONFIG.minimumPlacementMultiplier,
      (TOURNAMENT_PUBLICITY_CONFIG.topCutSize - placement.placement + 1) /
        TOURNAMENT_PUBLICITY_CONFIG.topCutSize,
    );
    attentionEvents.push({
      type: "TOURNAMENT_ATTENTION",
      tournamentId: registration.tournamentId,
      day: registration.eventDay,
      preset: registration.preset,
      playerId: placement.playerId,
      deckId: placement.deckId,
      placement: placement.placement,
      socialExposure: clampUnit(publicity.socialExposure * placementMultiplier),
      tournamentPrestige: clampUnit(
        publicity.tournamentPrestige * placementMultiplier,
      ),
    });
  }

  return { publicKnowledgeEvents, attentionEvents };
}

export function simulateTournament(
  world: WorldState,
  registration: TournamentRegistration,
): TournamentResult {
  if (registration.entrants.length < 2) {
    throw new RangeError(
      "Tournament simulation requires at least two entrants",
    );
  }
  if (registration.ruleVersion !== world.ruleVersion) {
    throw new Error(
      `Tournament RuleVersion ${registration.ruleVersion} does not match world ${world.ruleVersion}`,
    );
  }
  requireEntrantState(world, registration);
  const cards = new Map(
    Object.values(world.cards).map((card) => [card.id, card]),
  );
  let remaining = seededPairingOrder(
    registration.entrants,
    world.worldSeed,
    registration.tournamentId,
  );
  const matches: TournamentMatchResult[] = [];
  const rounds: TournamentRoundResult[] = [];
  const eliminated: EliminatedEntrant[] = [];
  let round = 1;
  let sequence = 0;

  while (remaining.length > 1) {
    const nextRound: TournamentEntrant[] = [];
    const matchIds: MatchId[] = [];
    const byePlayerIds: PlayerId[] = [];
    for (let index = 0; index < remaining.length; index += 2) {
      const entrantA = remaining[index]!;
      const entrantB = remaining[index + 1];
      if (entrantB === undefined) {
        nextRound.push(entrantA);
        byePlayerIds.push(entrantA.playerId);
        continue;
      }
      const seed = deriveSeed([
        world.worldSeed,
        registration.tournamentId,
        "tournament-match",
        round,
        index / 2,
        entrantA.playerId,
        entrantB.playerId,
      ]);
      const simulated = simulateMatch({
        seed,
        deckA: toDeckDefinition(world.decks[entrantA.deckId]!),
        deckB: toDeckDefinition(world.decks[entrantB.deckId]!),
        cards,
        strategyA: battleStrategy(world, entrantA),
        strategyB: battleStrategy(world, entrantB),
        recordActionLog: true,
      });
      const winner = simulated.winner === "A" ? entrantA : entrantB;
      const loser = simulated.winner === "A" ? entrantB : entrantA;
      const isFinal = remaining.length === 2;
      const isNotableUpset = winner.skill < loser.skill;
      const id = matchId(
        `${registration.tournamentId}-round-${round}-match-${index / 2}`,
      );
      const replay = isFinal || isNotableUpset ? simulated.replay : undefined;
      if ((isFinal || isNotableUpset) && replay === undefined) {
        throw new Error(`Important tournament Match ${id} has no replay`);
      }
      matches.push({
        id,
        round,
        sequence,
        playerAId: entrantA.playerId,
        playerBId: entrantB.playerId,
        deckAId: entrantA.deckId,
        deckBId: entrantB.deckId,
        winnerPlayerId: winner.playerId,
        winnerDeckId: winner.deckId,
        loserPlayerId: loser.playerId,
        loserDeckId: loser.deckId,
        turns: simulated.turns,
        isFinal,
        isNotableUpset,
        banlistVersionId: registration.banlistVersionId,
        ruleVersion: registration.ruleVersion,
        ...(replay === undefined ? {} : { replay }),
      });
      matchIds.push(id);
      eliminated.push({ entrant: loser, round, sequence });
      nextRound.push(winner);
      sequence += 1;
    }
    rounds.push({ round, matchIds, byePlayerIds });
    remaining = nextRound;
    round += 1;
  }

  const placements = placementOrder(remaining[0]!, eliminated);
  const top8 = placements.slice(0, TOURNAMENT_PUBLICITY_CONFIG.topCutSize);
  const publicity = publishTopDecks(world, registration, top8);
  return {
    tournamentId: registration.tournamentId,
    name: registration.name,
    preset: registration.preset,
    eventDay: registration.eventDay,
    banlistVersionId: registration.banlistVersionId,
    ruleVersion: registration.ruleVersion,
    rounds,
    matches,
    top8,
    winner: placements[0]!,
    ...publicity,
  };
}
