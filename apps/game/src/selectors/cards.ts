import type {
  CardDefinition,
  CardId,
  CardType,
  ExpansionId,
  FactionId,
  Keyword,
  Rarity,
  WorldState,
} from "../../../../packages/domain/src/index";
import type { DeepReadonly } from "../app/game-session/GameSessionController";

export type CardLegality = "LEGAL" | "RESTRICTED" | "BANNED";

export type CardListFilters = Readonly<{
  query?: string;
  expansionId?: ExpansionId;
  factionId?: FactionId;
  rarity?: Rarity;
  type?: CardType;
  cost?: number;
  keyword?: Keyword;
  legality?: CardLegality;
  minimumUsageRate?: number;
  minimumMarketPrice?: number;
}>;

export type CardSort = "NAME" | "COST" | "USAGE" | "MARKET_PRICE";

export type CardMarketView = Readonly<{
  lastPrice: number | null;
  dailyVolume: number;
  availableSupply: number;
}>;

export type CardListItem = Readonly<{
  id: CardId;
  name: string;
  type: CardType;
  factionId: FactionId;
  rarity: Rarity;
  cost: number;
  keywords: readonly Keyword[];
  expansionIds: readonly ExpansionId[];
  legality: CardLegality;
  usageRate: number;
  market: CardMarketView;
}>;

export type KnownSynergy = Readonly<{
  cardId: CardId;
  name: string;
  publicDeckCount: number;
}>;

export type CardDetailView = Readonly<{
  card: DeepReadonly<CardDefinition>;
  listItem: CardListItem;
  knownSynergies: readonly KnownSynergy[];
  observedDeckCount: number;
  tournamentDemand: Readonly<{
    deckId: string;
    tournamentId: string;
    day: number;
    tournamentPrestige: number;
  }> | null;
  history: readonly Readonly<{
    id: string;
    day: number;
    type: string;
  }>[];
}>;

type CardsWorld = DeepReadonly<WorldState>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function legalityForCard(world: CardsWorld, id: CardId): CardLegality {
  const policies = Object.values(world.operations ?? {})
    .filter(
      (operation) =>
        operation.type === "POLICY_CHANGE" &&
        operation.status === "COMPLETED" &&
        operation.payload.cardId === id,
    )
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
  const latest = policies.at(-1);
  if (latest?.type !== "POLICY_CHANGE") return "LEGAL";
  return latest.payload.kind === "BAN" ? "BANNED" : "RESTRICTED";
}

function expansionIdsForCard(world: CardsWorld, id: CardId): ExpansionId[] {
  return [
    ...new Set(
      Object.values(world.printings)
        .filter((printing) => printing.cardId === id)
        .map((printing) => printing.expansionId),
    ),
  ].sort(compareText);
}

function usageForCard(world: CardsWorld, id: CardId): number {
  return Object.entries(world.meta.deckStats).reduce(
    (usage, [deckId, stats]) =>
      world.decks[deckId]?.cards.some((entry) => entry.cardId === id)
        ? usage + stats.usageRate
        : usage,
    0,
  );
}

function marketForCard(world: CardsWorld, id: CardId): CardMarketView {
  const printingIds = new Set(
    Object.values(world.printings)
      .filter((printing) => printing.cardId === id)
      .map((printing) => printing.id),
  );
  const snapshots = Object.values(world.market.snapshots).filter((snapshot) =>
    printingIds.has(snapshot.printingId),
  );
  return {
    lastPrice:
      snapshots.length === 0
        ? null
        : snapshots.reduce((total, snapshot) => total + snapshot.lastPrice, 0) /
          snapshots.length,
    dailyVolume: snapshots.reduce(
      (total, snapshot) => total + snapshot.dailyVolume,
      0,
    ),
    availableSupply: snapshots.reduce(
      (total, snapshot) => total + snapshot.availableSupply,
      0,
    ),
  };
}

function listItem(
  world: CardsWorld,
  card: DeepReadonly<CardDefinition>,
): CardListItem {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    factionId: card.factionId,
    rarity: card.rarity,
    cost: card.cost,
    keywords: [...card.keywords],
    expansionIds: expansionIdsForCard(world, card.id),
    legality: legalityForCard(world, card.id),
    usageRate: usageForCard(world, card.id),
    market: marketForCard(world, card.id),
  };
}

function matchesFilters(card: CardListItem, filters: CardListFilters): boolean {
  const query = filters.query?.trim().toLocaleLowerCase("en-US");
  return (
    (query === undefined ||
      query.length === 0 ||
      card.name.toLocaleLowerCase("en-US").includes(query) ||
      card.id.toLocaleLowerCase("en-US").includes(query)) &&
    (filters.expansionId === undefined ||
      card.expansionIds.includes(filters.expansionId)) &&
    (filters.factionId === undefined || card.factionId === filters.factionId) &&
    (filters.rarity === undefined || card.rarity === filters.rarity) &&
    (filters.type === undefined || card.type === filters.type) &&
    (filters.cost === undefined || card.cost === filters.cost) &&
    (filters.keyword === undefined ||
      card.keywords.includes(filters.keyword)) &&
    (filters.legality === undefined || card.legality === filters.legality) &&
    (filters.minimumUsageRate === undefined ||
      card.usageRate >= filters.minimumUsageRate) &&
    (filters.minimumMarketPrice === undefined ||
      filters.minimumMarketPrice <= 0 ||
      (card.market.lastPrice ?? -1) >= filters.minimumMarketPrice)
  );
}

function compareCards(
  sort: CardSort,
  left: CardListItem,
  right: CardListItem,
): number {
  switch (sort) {
    case "COST":
      return left.cost - right.cost || compareText(left.id, right.id);
    case "USAGE":
      return right.usageRate - left.usageRate || compareText(left.id, right.id);
    case "MARKET_PRICE":
      return (
        (right.market.lastPrice ?? -1) - (left.market.lastPrice ?? -1) ||
        compareText(left.id, right.id)
      );
    case "NAME":
      return (
        compareText(left.name, right.name) || compareText(left.id, right.id)
      );
  }
}

export function selectCards(
  world: CardsWorld,
  filters: CardListFilters = {},
  sort: CardSort = "NAME",
): CardListItem[] {
  return Object.values(world.cards)
    .map((card) => listItem(world, card))
    .filter((card) => matchesFilters(card, filters))
    .sort((left, right) => compareCards(sort, left, right));
}

function publiclyKnownDeckIds(world: CardsWorld): Set<string> {
  const deckIds = new Set<string>();
  for (const event of world.history.events) {
    if (
      event.type !== "TOURNAMENT_COMPLETED" ||
      event.context?.reason === undefined
    ) {
      continue;
    }
    try {
      const result = JSON.parse(event.context.reason) as {
        publicKnowledgeEvents?: Array<{ deckId?: string }>;
      };
      for (const exposure of result.publicKnowledgeEvents ?? []) {
        if (exposure.deckId !== undefined && world.decks[exposure.deckId]) {
          deckIds.add(exposure.deckId);
        }
      }
    } catch {
      continue;
    }
  }
  return deckIds;
}

export function selectKnownSynergies(
  world: CardsWorld,
  id: CardId,
): KnownSynergy[] {
  const publicDeckIds = publiclyKnownDeckIds(world);
  const counts = new Map<CardId, number>();
  for (const deckId of [...publicDeckIds].sort(compareText)) {
    const deck = world.decks[deckId];
    if (
      deck === undefined ||
      !deck.cards.some((entry) => entry.cardId === id)
    ) {
      continue;
    }
    for (const entry of deck.cards) {
      if (entry.cardId !== id) {
        counts.set(entry.cardId, (counts.get(entry.cardId) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([cardId, publicDeckCount]) => ({
      cardId,
      name: world.cards[cardId]?.name ?? cardId,
      publicDeckCount,
    }))
    .sort(
      (left, right) =>
        right.publicDeckCount - left.publicDeckCount ||
        compareText(left.cardId, right.cardId),
    );
}

export function selectCardDetail(
  world: CardsWorld,
  id: CardId,
): CardDetailView | null {
  const card = world.cards[id];
  if (card === undefined) return null;
  const tournamentDemand = [
    ...(world.operationEvidence?.tournamentAttention ?? []),
  ]
    .filter(
      (attention) =>
        world.decks[attention.deckId]?.cards.some(
          (entry) => entry.cardId === id,
        ) === true,
    )
    .sort(
      (left, right) =>
        right.day - left.day ||
        right.tournamentPrestige - left.tournamentPrestige ||
        compareText(left.deckId, right.deckId),
    )[0];
  return {
    card,
    listItem: listItem(world, card),
    knownSynergies: selectKnownSynergies(world, id),
    observedDeckCount: Object.values(world.decks).filter((deck) =>
      deck.cards.some((entry) => entry.cardId === id),
    ).length,
    tournamentDemand:
      tournamentDemand === undefined ? null : { ...tournamentDemand },
    history: world.history.events
      .filter((event) => event.context?.reason?.includes(id) === true)
      .map((event) => ({ id: event.id, day: event.day, type: event.type }))
      .sort(
        (left, right) => right.day - left.day || compareText(left.id, right.id),
      ),
  };
}
