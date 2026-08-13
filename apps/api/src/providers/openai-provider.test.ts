import type {
  CardProposalRequest,
  CardProposalResponse,
} from "@tcgtycoon/ai-contracts";
import {
  cardProposalRequestSchema,
  cardProposalResponseSchema,
} from "@tcgtycoon/ai-contracts";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config";
import {
  OpenAIGenerativeProvider,
  OpenAIProviderError,
  type OpenAIResponsesClient,
  type StructuredResponseRequest,
} from "./openai-provider";
import { createGenerativeProvider } from "./provider-factory";

const cardRequest: CardProposalRequest = cardProposalRequestSchema.parse({
  cardId: "card-scrap-hound",
  factionId: "machine",
  designIntent: "A cheap mechanical hound that rewards unit deaths.",
  setTheme: "Enchanted industrial salvage",
  visualKeywords: ["brass", "smoke"],
});

const legalCardResponse: CardProposalResponse =
  cardProposalResponseSchema.parse({
    proposal: {
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
    },
    displayText: "Deathrattle: Draw a card.",
    risk: {
      level: "MEDIUM",
      categories: ["CARD_ADVANTAGE", "SYNERGY_LOOP"],
      explanation: "Death-trigger support can compound card advantage.",
    },
    translationNotes: [],
  });

function createFakeClient(outputs: Array<string | Error>): {
  client: OpenAIResponsesClient;
  create: ReturnType<
    typeof vi.fn<
      (input: StructuredResponseRequest) => Promise<{ output_text: string }>
    >
  >;
} {
  const queue = [...outputs];
  const create = vi.fn(
    async (
      input: StructuredResponseRequest,
    ): Promise<{ output_text: string }> => {
      void input;
      const next = queue.shift();
      if (next === undefined) {
        throw new Error("Fake response queue exhausted");
      }
      if (next instanceof Error) {
        throw next;
      }
      return { output_text: next };
    },
  );

  return { client: { responses: { create } }, create };
}

describe("OpenAIGenerativeProvider", () => {
  it("loads server-only OpenAI configuration and selects the OpenAI provider", () => {
    const config = loadConfig({
      AI_MODE: "openai",
      OPENAI_API_KEY: "test-key",
      OPENAI_TEXT_MODEL: "gpt-configured",
      OPENAI_IMAGE_MODEL: "image-configured",
      PORT: "4001",
    });

    expect(config).toEqual({
      aiMode: "openai",
      openaiApiKey: "test-key",
      textModel: "gpt-configured",
      imageModel: "image-configured",
      port: 4_001,
    });
    expect(createGenerativeProvider(config)).toBeInstanceOf(
      OpenAIGenerativeProvider,
    );
    expect(() => loadConfig({ AI_MODE: "openai", OPENAI_API_KEY: "" })).toThrow(
      "OPENAI_API_KEY is required",
    );
  });

  it("uses Responses strict JSON Schema with configured model and stateless storage", async () => {
    const { client, create } = createFakeClient([
      JSON.stringify(legalCardResponse),
    ]);
    const provider = new OpenAIGenerativeProvider(client, {
      textModel: "gpt-test",
      imageModel: "image-test",
    });

    await expect(provider.proposeCard(cardRequest)).resolves.toEqual(
      legalCardResponse,
    );

    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "gpt-test",
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "card_proposal_response",
          strict: true,
        },
      },
    });
    expect(JSON.stringify(request?.input)).toContain(cardRequest.designIntent);
    expect(JSON.stringify(request?.text.format.schema)).toContain(
      "DEATHRATTLE",
    );
    expect(JSON.stringify(request?.text.format.schema)).not.toContain("SECRET");
  });

  it("retries one invalid contract response with a validation summary", async () => {
    const invalidResponse = {
      ...legalCardResponse,
      proposal: { ...legalCardResponse.proposal, keywords: ["SECRET"] },
    };
    const { client, create } = createFakeClient([
      JSON.stringify(invalidResponse),
      JSON.stringify(legalCardResponse),
    ]);
    const provider = new OpenAIGenerativeProvider(client, {
      textModel: "gpt-test",
      imageModel: "image-test",
    });

    await expect(provider.proposeCard(cardRequest)).resolves.toEqual(
      legalCardResponse,
    );

    expect(create).toHaveBeenCalledTimes(2);
    const retryInput = JSON.stringify(create.mock.calls[1]?.[0].input);
    expect(retryInput).toContain("Validation failed");
    expect(retryInput).toContain("proposal.keywords");
    expect(create.mock.calls[1]?.[0].text.format.strict).toBe(true);
  });

  it("rejects output that still fails shared Zod validation after two attempts", async () => {
    const { client, create } = createFakeClient(["{}", "{}"]);
    const provider = new OpenAIGenerativeProvider(client, {
      textModel: "gpt-test",
      imageModel: "image-test",
    });

    await expect(provider.proposeCard(cardRequest)).rejects.toMatchObject({
      name: "OpenAIProviderError",
      code: "INVALID_OUTPUT",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("wraps provider API errors without retrying or returning simulation data", async () => {
    const { client, create } = createFakeClient([
      new Error("upstream unavailable"),
    ]);
    const provider = new OpenAIGenerativeProvider(client, {
      textModel: "gpt-test",
      imageModel: "image-test",
    });

    const result = provider.proposeCard(cardRequest);
    await expect(result).rejects.toBeInstanceOf(OpenAIProviderError);
    await expect(result).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
