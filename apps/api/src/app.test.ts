import {
  artGenerateResponseSchema,
  cardProposalResponseSchema,
  communityRenderResponseSchema,
  setCompletionResponseSchema,
  worldAssistResponseSchema,
} from "@tcgtycoon/ai-contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { MockGenerativeProvider } from "./providers/mock-provider";
import type { GenerativeProvider } from "./providers/types";

const routeCases = [
  {
    path: "/v1/world/assist",
    input: {
      gameName: "Relic Circuit",
      settingPrompt: "Ancient machines awaken beneath rival city-states.",
      visualKeywords: ["brass", "stormlight"],
    },
    responseSchema: worldAssistResponseSchema,
  },
  {
    path: "/v1/cards/propose",
    input: {
      cardId: "card-scrap-hound",
      factionId: "machine",
      designIntent: "A cheap mechanical hound that rewards unit deaths.",
      setTheme: "Enchanted industrial salvage",
      visualKeywords: ["brass", "smoke"],
    },
    responseSchema: cardProposalResponseSchema,
  },
  {
    path: "/v1/sets/complete",
    input: {
      expansionId: "expansion-launch",
      setName: "First Ignition",
      setBrief: "Introduce four factions with straightforward mechanics.",
      visualKeywords: ["awakening", "relics"],
      existingCards: [],
      openSlots: [
        {
          slotId: "slot-01",
          cardId: "card-slot-01",
          factionId: "machine",
          rarity: "COMMON",
          type: "UNIT",
          designRole: "Simple early-game unit",
        },
      ],
    },
    responseSchema: setCompletionResponseSchema,
  },
  {
    path: "/v1/community/render",
    input: {
      day: 12,
      agent: {
        id: "agent-mika",
        name: "Mika Vale",
        role: "BREWER",
        personalityTraits: ["curious", "direct"],
        favoriteFactionId: "machine",
        riskTolerance: 0.7,
        brandAttitude: -0.2,
        influence: 0.6,
      },
      knownFacts: [
        {
          kind: "META_USAGE",
          entityId: "deck-grave-loop",
          statement: "Grave Loop reached 18% observed usage.",
        },
      ],
      recentMemories: ["Lost a Regional final to Grave Loop."],
      requestedTopic: "Grave Loop's current Meta presence",
      requestedStance: "CONCERNED",
    },
    responseSchema: communityRenderResponseSchema,
  },
  {
    path: "/v1/art/generate",
    input: {
      assetPurpose: "CARD_ART",
      visualBrief: {
        subject: "A brass hound assembled from enchanted salvage",
        composition: "Low heroic angle with the hound centered",
        styleKeywords: ["painterly", "industrial fantasy"],
        colorPalette: ["burnished brass", "smoke gray"],
      },
      referenceEntityIds: ["card-scrap-hound"],
    },
    responseSchema: artGenerateResponseSchema,
  },
] as const;

describe("AI gateway", () => {
  const provider: GenerativeProvider = new MockGenerativeProvider();
  const app = createApp(provider);

  it.each(routeCases)(
    "returns deterministic legal JSON from $path",
    async ({ path, input, responseSchema }) => {
      const request = () =>
        app.request(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });

      const first = await request();
      const second = await request();
      const firstText = await first.text();
      const secondText = await second.text();

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(secondText).toBe(firstText);
      expect(() => responseSchema.parse(JSON.parse(firstText))).not.toThrow();
    },
  );

  it.each(routeCases)(
    "returns 400 for invalid $path input",
    async ({ path }) => {
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });

      expect(response.status).toBe(400);
    },
  );

  it.each([
    {
      path: "/v1/world/assist",
      input: {
        gameName: "G".repeat(120),
        settingPrompt: "S".repeat(2_000),
        visualKeywords: [],
      },
    },
    {
      path: "/v1/cards/propose",
      input: {
        cardId: "card-boundary",
        factionId: "machine",
        designIntent: "D".repeat(2_000),
        setTheme: "T".repeat(500),
        visualKeywords: [],
      },
    },
    {
      path: "/v1/sets/complete",
      input: {
        expansionId: "expansion-boundary",
        setName: "Boundary Set",
        setBrief: "B".repeat(4_000),
        visualKeywords: [],
        existingCards: [],
        openSlots: [
          {
            slotId: "slot-boundary",
            cardId: "card-slot-boundary",
            factionId: "machine",
            rarity: "COMMON",
            type: "UNIT",
            designRole: "R".repeat(500),
          },
        ],
      },
    },
    {
      path: "/v1/community/render",
      input: {
        day: 12,
        agent: {
          id: "agent-boundary",
          name: "Boundary Agent",
          role: "COMMENTATOR",
          personalityTraits: [],
          riskTolerance: 0.5,
          brandAttitude: 0,
          influence: 0.5,
        },
        knownFacts: Array.from({ length: 32 }, (_, index) => ({
          kind: "KNOWN_ENTITY",
          entityId: `entity-${index}`,
          statement: `Known fact ${index}`,
        })),
        recentMemories: [],
        requestedTopic: "Known entities",
        requestedStance: "NEUTRAL",
      },
    },
  ])(
    "keeps mock output legal for bounded $path input",
    async ({ path, input }) => {
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      expect(response.status).toBe(200);
    },
  );
});
