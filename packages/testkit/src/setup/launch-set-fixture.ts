import {
  cardId,
  deckId,
  expansionId,
  factionId,
  type CardDefinition,
  type DeckDefinition,
  type Expansion,
  type FactionId,
  type Rarity,
} from "@tcgtycoon/domain";

export type LaunchFactionFixture = {
  id: FactionId;
  name: string;
};

export type LaunchSetFixture = {
  factions: LaunchFactionFixture[];
  expansion: Expansion;
  cards: CardDefinition[];
  starterDecks: DeckDefinition[];
};

const FACTIONS: readonly LaunchFactionFixture[] = [
  { id: factionId("ember"), name: "Ember League" },
  { id: factionId("tide"), name: "Tide Assembly" },
  { id: factionId("grove"), name: "Verdant Pact" },
  { id: factionId("machine"), name: "Machine Union" },
];

function rarityForIndex(index: number): Rarity {
  if (index < 20) return "COMMON";
  if (index < 34) return "UNCOMMON";
  if (index < 44) return "RARE";
  return "LEGENDARY";
}

function createUnit(
  id: string,
  name: string,
  faction: FactionId,
  index: number,
): CardDefinition {
  return {
    id: cardId(id),
    name,
    type: "UNIT",
    factionId: faction,
    rarity: rarityForIndex(index),
    cost: (index % 8) + 1,
    attack: (index % 6) + 1,
    health: (index % 7) + 1,
    keywords: [],
    triggers: [],
  };
}

function createCards(): CardDefinition[] {
  const cards: CardDefinition[] = [];
  for (const faction of FACTIONS) {
    for (let slot = 1; slot <= 10; slot += 1) {
      const index = cards.length;
      cards.push(
        createUnit(
          `card-launch-${faction.id}-${slot}`,
          `${faction.name} ${slot}`,
          faction.id,
          index,
        ),
      );
    }
  }
  for (let slot = 1; slot <= 8; slot += 1) {
    const index = cards.length;
    cards.push(
      createUnit(
        `card-launch-neutral-${slot}`,
        `Neutral Vanguard ${slot}`,
        factionId("neutral"),
        index,
      ),
    );
  }
  return cards;
}

function createStarterDecks(
  cards: readonly CardDefinition[],
): DeckDefinition[] {
  const neutralCards = cards.filter((card) => card.factionId === "neutral");
  return FACTIONS.map((faction) => {
    const factionCards = cards.filter((card) => card.factionId === faction.id);
    return {
      id: deckId(`deck-launch-starter-${faction.id}`),
      name: `${faction.name} Starter`,
      factionId: faction.id,
      cards: [...factionCards.slice(0, 8), ...neutralCards.slice(0, 2)].map(
        (card) => ({ cardId: card.id, count: 2 }),
      ),
    };
  });
}

export function createLaunchSetFixture(): LaunchSetFixture {
  const cards = createCards();
  return {
    factions: FACTIONS.map((faction) => ({ ...faction })),
    expansion: {
      id: expansionId("set-launch"),
      name: "Launch Set",
    },
    cards,
    starterDecks: createStarterDecks(cards),
  };
}
