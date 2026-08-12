import {
  artGenerateResponseSchema,
  cardProposalResponseSchema,
  communityRenderResponseSchema,
  setCompletionResponseSchema,
  worldAssistResponseSchema,
  type ArtGenerateRequest,
  type ArtGenerateResponse,
  type CardProposalRequest,
  type CardProposalResponse,
  type CommunityRenderRequest,
  type CommunityRenderResponse,
  type SetCompletionRequest,
  type SetCompletionResponse,
  type SetCompletionSlot,
  type WorldAssistRequest,
  type WorldAssistResponse,
} from "@tcgtycoon/ai-contracts";
import type { GenerativeProvider } from "./types";

const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

function bounded(value: string, maximumLength: number): string {
  return value.slice(0, maximumLength);
}

function createCardForSlot(slot: SetCompletionSlot) {
  const base = {
    id: slot.cardId,
    name: `Mock ${slot.slotId}`,
    factionId: slot.factionId,
    rarity: slot.rarity,
    cost: slot.type === "UNIT" ? 2 : 1,
    keywords: [],
    triggers: [],
  } as const;

  if (slot.type === "UNIT") {
    return { ...base, type: "UNIT" as const, attack: 2, health: 3 };
  }

  return { ...base, type: "SPELL" as const };
}

export class MockGenerativeProvider implements GenerativeProvider {
  async assistWorld(input: WorldAssistRequest): Promise<WorldAssistResponse> {
    return worldAssistResponseSchema.parse({
      settingSummary: bounded(
        `${input.gameName}: ${input.settingPrompt}`,
        2_000,
      ),
      factions: [
        {
          id: "mock-vanguard",
          name: bounded(`${input.gameName} Vanguard`, 120),
          concept: "Direct pressure with resilient frontline units.",
          visualKeywords: input.visualKeywords.slice(0, 8),
        },
        {
          id: "mock-archive",
          name: bounded(`${input.gameName} Archive`, 120),
          concept: "Patient play supported by knowledge and card flow.",
          visualKeywords: input.visualKeywords.slice(0, 8),
        },
        {
          id: "mock-grove",
          name: bounded(`${input.gameName} Grove`, 120),
          concept: "Unit growth, healing, and board development.",
          visualKeywords: input.visualKeywords.slice(0, 8),
        },
        {
          id: "mock-forge",
          name: bounded(`${input.gameName} Forge`, 120),
          concept: "Efficient constructs and death-trigger synergies.",
          visualKeywords: input.visualKeywords.slice(0, 8),
        },
      ],
    });
  }

  async proposeCard(input: CardProposalRequest): Promise<CardProposalResponse> {
    return cardProposalResponseSchema.parse({
      proposal: {
        id: input.cardId,
        name: "Mock Vanguard",
        type: "UNIT",
        factionId: input.factionId,
        rarity: "COMMON",
        cost: 2,
        attack: 2,
        health: 3,
        keywords: [],
        triggers: [],
      },
      displayText: "No rules text.",
      risk: {
        level: "LOW",
        categories: ["STATS_EFFICIENCY"],
        explanation: bounded(
          `Deterministic mock proposal for: ${input.designIntent}`,
          2_000,
        ),
      },
      translationNotes: [bounded(`Set theme: ${input.setTheme}`, 500)],
    });
  }

  async completeSet(
    input: SetCompletionRequest,
  ): Promise<SetCompletionResponse> {
    return setCompletionResponseSchema.parse({
      proposals: input.openSlots.map((slot) => ({
        slotId: slot.slotId,
        proposal: createCardForSlot(slot),
        displayText: "No rules text.",
        risk: {
          level: "LOW",
          categories: ["COMPLEXITY"],
          explanation: `Deterministic mock completion for ${input.setName}.`,
        },
        translationNotes: [bounded(`Design role: ${slot.designRole}`, 500)],
      })),
    });
  }

  async renderCommunityPost(
    input: CommunityRenderRequest,
  ): Promise<CommunityRenderResponse> {
    const referencedEntityIds = [
      ...new Set(
        input.knownFacts.flatMap((fact) =>
          fact.entityId === undefined ? [] : [fact.entityId],
        ),
      ),
    ].slice(0, 16);

    return communityRenderResponseSchema.parse({
      topic: input.requestedTopic,
      stance: input.requestedStance,
      sentiment: input.agent.brandAttitude,
      referencedEntityIds,
      text: `${input.agent.name} expressed ${input.requestedStance.toLowerCase()} views about ${input.requestedTopic}.`,
    });
  }

  async generateArtwork(
    input: ArtGenerateRequest,
  ): Promise<ArtGenerateResponse> {
    return artGenerateResponseSchema.parse({
      mediaType: "image/png",
      base64Data: MOCK_PNG_BASE64,
      revisedPrompt: `${input.assetPurpose}: ${input.visualBrief.subject}; ${input.visualBrief.composition}`,
    });
  }
}
