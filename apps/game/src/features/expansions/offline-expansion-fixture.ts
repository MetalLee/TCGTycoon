import {
  cardId,
  expansionId,
  factionId,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";
import { createLaunchSetFixture } from "../../../../../packages/testkit/src/index";

export const OFFLINE_EXPANSION_ID = expansionId("set-offline-fixture");

export function createOfflineExpansionCommands(): PublisherCommand[] {
  const launchCards = createLaunchSetFixture().cards;
  const selected = [
    ...launchCards.filter((card) => card.rarity === "COMMON").slice(0, 12),
    ...launchCards.filter((card) => card.rarity === "UNCOMMON").slice(0, 6),
    ...launchCards.filter((card) => card.rarity === "RARE").slice(0, 4),
    ...launchCards.filter((card) => card.rarity === "LEGENDARY").slice(0, 2),
  ];
  const drafts = selected.map((card, index) => ({
    ...structuredClone(card),
    id: cardId(`card-offline-expansion-${String(index + 1).padStart(2, "0")}`),
    name: `Offline Expansion ${index + 1}`,
  }));
  return [
    {
      type: "CREATE_EXPANSION",
      expansionId: OFFLINE_EXPANSION_ID,
      name: "Offline Fixture Expansion",
      size: 24,
      brief: {
        theme: "Deterministic offline publisher fixture",
        focusFactionIds: [factionId("ember"), factionId("tide")],
        strategicDirections: ["exercise a legal small-set pipeline"],
        productPositioning: "small follow-up booster set",
      },
    },
    ...drafts.map((draft): PublisherCommand => ({
      type: "UPDATE_CARD_DRAFT",
      expansionId: OFFLINE_EXPANSION_ID,
      cardId: draft.id,
      draft,
    })),
  ];
}
