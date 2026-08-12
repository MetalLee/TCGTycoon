import {
  cardId,
  expansionId,
  factionId,
  tournamentId,
  type PublisherCommand,
  type WorldState,
} from "@tcgtycoon/domain";

const COMPLETION_EXPANSION_ID = expansionId("set-completion-bot");

function expansionCommands(world: WorldState): PublisherCommand[] {
  const source = Object.values(world.cards)
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .slice(0, 24);
  if (source.length < 24) return [];
  const rarities = [
    ...Array(12).fill("COMMON"),
    ...Array(6).fill("UNCOMMON"),
    ...Array(4).fill("RARE"),
    ...Array(2).fill("LEGENDARY"),
  ] as const;
  return [
    {
      type: "CREATE_EXPANSION",
      expansionId: COMPLETION_EXPANSION_ID,
      name: "Completion Bot Expansion",
      size: 24,
      brief: {
        theme: "Long-run operations regression",
        focusFactionIds: [factionId("fire"), factionId("machine")],
        strategicDirections: ["exercise every publisher subsystem"],
        productPositioning: "fixture booster",
      },
    },
    ...source.map((card, index): PublisherCommand => {
      const draft = {
        ...structuredClone(card),
        id: cardId(`card-completion-bot-${String(index + 1).padStart(2, "0")}`),
        rarity: rarities[index]! as typeof card.rarity,
        keywords: [],
        triggers: [],
      };
      return {
        type: "UPDATE_CARD_DRAFT",
        expansionId: COMPLETION_EXPANSION_ID,
        cardId: draft.id,
        draft,
      };
    }),
  ];
}

export class CompletionPublisherBot {
  decide(world: WorldState): PublisherCommand[] {
    if (world.status === "GAME_OVER") return [];
    const project = world.expansionProjects?.[COMPLETION_EXPANSION_ID];
    if (world.day === 1 && project === undefined)
      return expansionCommands(world);
    if (world.day === 2 && project !== undefined) {
      return [
        { type: "START_PLAYTEST", expansionId: project.id, tier: "QUICK" },
        {
          type: "START_CAMPAIGN",
          campaignType: "SOCIAL_MEDIA_ADS",
          durationDays: 3,
          startDay: world.day,
        },
        {
          type: "CREATE_TOURNAMENT",
          tournamentId: tournamentId("tournament-completion-bot"),
          name: "Completion Bot Open",
          preset: "LOCAL",
          eventDay: world.day + 2,
        },
        {
          type: "PUBLISH_ANNOUNCEMENT",
          topic: "DEVELOPMENT",
          text: "The completion regression is exercising publisher operations.",
          subjectId: project.id,
          commitment: {
            type: "FINALIZE_EXPANSION",
            subjectId: project.id,
            dueDay: world.day + 1,
          },
        },
      ];
    }
    if (
      world.day === 3 &&
      project !== undefined &&
      project.stage !== "FINALIZED"
    ) {
      return [{ type: "FINALIZE_EXPANSION", expansionId: project.id }];
    }
    if (world.day === 4) {
      const target = Object.values(world.cards).sort((left, right) =>
        left.id < right.id ? -1 : 1,
      )[0];
      return target === undefined
        ? []
        : [
            {
              type: "SCHEDULE_RESTRICTION",
              cardId: target.id,
              timing: "SCHEDULED",
            },
          ];
    }
    const booster =
      world.products[`product-${COMPLETION_EXPANSION_ID}-booster`];
    if (world.day === 5 && booster !== undefined) {
      return [
        { type: "ORDER_PRINT_RUN", productId: booster.id, quantity: 500 },
        {
          type: "SCHEDULE_RELEASE",
          productId: booster.id,
          releaseDay: world.day + 10,
        },
      ];
    }
    return [];
  }
}
