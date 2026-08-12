import { describe, expect, it } from "vitest";
import {
  artGenerateRequestSchema,
  cardProposalResponseSchema,
  communityFactPacketSchema,
  communityRenderRequestSchema,
  communityRenderResponseSchema,
  setCompletionResponseSchema,
  worldAssistResponseSchema,
} from "./index";

const legalCard = {
  id: "card-scrap-hound",
  name: "Scrap Hound",
  type: "UNIT",
  factionId: "machine",
  rarity: "COMMON",
  cost: 2,
  attack: 3,
  health: 2,
  keywords: ["DEATHRATTLE"],
  triggers: [
    {
      trigger: "ON_DEATH",
      conditions: [],
      effects: [{ type: "DRAW", amount: 1, target: "FRIENDLY_HERO" }],
    },
  ],
};

describe("shared AI contracts", () => {
  it("validates a four-faction world-assist response", () => {
    const response = worldAssistResponseSchema.parse({
      settingSummary: "Rival salvage guilds awaken forgotten machine spirits.",
      factions: [
        {
          id: "machine",
          name: "Iron Choir",
          concept: "Relentless construct recursion.",
          visualKeywords: ["brass", "smoke"],
        },
        {
          id: "verdant",
          name: "Verdant Pact",
          concept: "Patient growth and restoration.",
          visualKeywords: ["moss", "sunlight"],
        },
        {
          id: "ember",
          name: "Ember Court",
          concept: "Fast pressure and direct damage.",
          visualKeywords: ["cinders", "velvet"],
        },
        {
          id: "tide",
          name: "Tide Archive",
          concept: "Knowledge, control, and card flow.",
          visualKeywords: ["ink", "glass"],
        },
      ],
    });

    expect(response.factions).toHaveLength(4);
  });

  it("requires card proposals to contain legal structured DSL and risk metadata", () => {
    const response = cardProposalResponseSchema.parse({
      proposal: legalCard,
      displayText: "Deathrattle: Draw a card.",
      risk: {
        level: "MEDIUM",
        categories: ["CARD_ADVANTAGE", "SYNERGY_LOOP"],
        explanation:
          "Efficient recursion may amplify death-trigger strategies.",
      },
      translationNotes: [],
    });

    expect(response.proposal.keywords).toEqual(["DEATHRATTLE"]);
    expect(response.risk.level).toBe("MEDIUM");
    expect(() =>
      cardProposalResponseSchema.parse({
        ...response,
        proposal: { ...legalCard, keywords: ["SECRET"] },
      }),
    ).toThrow();
  });

  it("rejects unsupported keyword strings in set-completion responses", () => {
    const valid = {
      proposals: [
        {
          slotId: "slot-01",
          proposal: legalCard,
          displayText: "Deathrattle: Draw a card.",
          risk: {
            level: "LOW",
            categories: ["CARD_ADVANTAGE"],
            explanation: "A narrow, known source of card advantage.",
          },
          translationNotes: [],
        },
      ],
    };

    expect(setCompletionResponseSchema.parse(valid).proposals).toHaveLength(1);
    expect(() =>
      setCompletionResponseSchema.parse({
        proposals: [
          {
            ...valid.proposals[0],
            proposal: { ...legalCard, keywords: ["SECRET"] },
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts only a finite supplied community Fact Packet", () => {
    const request = {
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
    };

    expect(communityFactPacketSchema.parse(request).knownFacts).toHaveLength(1);
    expect(communityRenderRequestSchema.parse(request).agent.id).toBe(
      "agent-mika",
    );
    expect(() =>
      communityRenderRequestSchema.parse({
        ...request,
        worldState: { hiddenDeckWinRates: { "deck-grave-loop": 0.73 } },
      }),
    ).toThrow();
    expect(() =>
      communityRenderRequestSchema.parse({
        ...request,
        knownFacts: Array.from({ length: 33 }, (_, index) => ({
          kind: "FACT",
          statement: `Fact ${index}`,
        })),
      }),
    ).toThrow();
  });

  it("returns exact community metadata with bounded sentiment", () => {
    const response = {
      topic: "Grave Loop's current Meta presence",
      stance: "CONCERNED",
      sentiment: -0.4,
      referencedEntityIds: ["deck-grave-loop"],
      text: "Grave Loop is everywhere, and the field needs room to breathe.",
    };

    expect(communityRenderResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      communityRenderResponseSchema.parse({ ...response, sentiment: 1.01 }),
    ).toThrow();
    expect(() =>
      communityRenderResponseSchema.parse({ ...response, inventedFact: true }),
    ).toThrow();
  });

  it("carries a stable artwork purpose and visual brief without WorldState", () => {
    const request = {
      assetPurpose: "CARD_ART",
      visualBrief: {
        subject: "A brass hound assembled from enchanted salvage",
        composition: "Low heroic angle with the hound centered",
        styleKeywords: ["painterly", "industrial fantasy"],
        colorPalette: ["burnished brass", "smoke gray"],
      },
      referenceEntityIds: ["card-scrap-hound"],
    };

    expect(artGenerateRequestSchema.parse(request).assetPurpose).toBe(
      "CARD_ART",
    );
    expect(() =>
      artGenerateRequestSchema.parse({ ...request, worldState: {} }),
    ).toThrow();
    expect(() =>
      artGenerateRequestSchema.parse({
        ...request,
        assetPurpose: "WORLD_STATE_SCREENSHOT",
      }),
    ).toThrow();
  });
});
