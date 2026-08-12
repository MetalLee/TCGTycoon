import {
  cardProposalResponseSchema,
  setCompletionResponseSchema,
  worldAssistResponseSchema,
  type CardProposalRequest,
  type SetCompletionRequest,
  type WorldAssistRequest,
} from "../../../../../packages/ai-contracts/src/index";
import { cardId, factionId } from "../../../../../packages/domain/src/index";
import { describe, expect, it, vi } from "vitest";
import { AiClientError, createAiClient, type AiFetch } from "./ai-client";

const cardRequest: CardProposalRequest = {
  cardId: cardId("card-client-test"),
  factionId: factionId("machine"),
  designIntent: "A defensive salvage guardian.",
  setTheme: "Industrial fantasy",
  visualKeywords: ["brass"],
};

const cardResponse = cardProposalResponseSchema.parse({
  proposal: {
    id: "card-client-test",
    name: "Salvage Guardian",
    type: "UNIT",
    factionId: "machine",
    rarity: "COMMON",
    cost: 3,
    attack: 2,
    health: 4,
    keywords: ["TAUNT"],
    triggers: [],
  },
  displayText: "Taunt",
  risk: {
    level: "LOW",
    categories: ["STATS_EFFICIENCY"],
    explanation: "Defensive baseline stats.",
  },
  translationNotes: [],
});

const worldRequest: WorldAssistRequest = {
  gameName: "Relic Circuit",
  settingPrompt: "Ancient machines awaken beneath rival city-states.",
  visualKeywords: ["brass", "stormlight"],
};

const worldResponse = worldAssistResponseSchema.parse({
  settingSummary: "Four city-states bind awakened relic machines.",
  factions: ["forge", "tide", "grove", "archive"].map((id) => ({
    id,
    name: `${id} faction`,
    concept: `${id} concept`,
    visualKeywords: [id],
  })),
});

const setRequest: SetCompletionRequest = {
  expansionId: "set-client-test" as SetCompletionRequest["expansionId"],
  setName: "Client Test Set",
  setBrief: "Industrial fantasy",
  visualKeywords: ["brass"],
  existingCards: [],
  openSlots: [
    {
      slotId: "slot-1",
      cardId: cardId("card-client-test"),
      factionId: factionId("machine"),
      rarity: "COMMON",
      type: "UNIT",
      designRole: "Defensive unit",
    },
  ],
};

const setResponse = setCompletionResponseSchema.parse({
  proposals: [{ slotId: "slot-1", ...cardResponse }],
});

describe("AiClient", () => {
  it.each([
    {
      name: "world assistance",
      path: "/v1/world/assist",
      input: worldRequest,
      output: worldResponse,
      invoke: (client: ReturnType<typeof createAiClient>) =>
        client.assistWorld(worldRequest),
    },
    {
      name: "card proposal",
      path: "/v1/cards/propose",
      input: cardRequest,
      output: cardResponse,
      invoke: (client: ReturnType<typeof createAiClient>) =>
        client.proposeCard(cardRequest),
    },
    {
      name: "set completion",
      path: "/v1/sets/complete",
      input: setRequest,
      output: setResponse,
      invoke: (client: ReturnType<typeof createAiClient>) =>
        client.completeSet(setRequest),
    },
  ])(
    "posts and validates $name responses",
    async ({ path, input, output, invoke }) => {
      const fetch = vi.fn<AiFetch>(
        async () =>
          new Response(JSON.stringify(output), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      );
      const client = createAiClient({ baseUrl: "https://ai.test", fetch });

      await expect(invoke(client)).resolves.toEqual(output);
      expect(fetch).toHaveBeenCalledWith(
        `https://ai.test${path}`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(input),
        }),
      );
    },
  );

  it("rejects a successful HTTP response that fails the shared contract", async () => {
    const client = createAiClient({
      fetch: async () =>
        new Response(JSON.stringify({ proposal: { keywords: ["SECRET"] } }), {
          status: 200,
        }),
    });

    await expect(client.proposeCard(cardRequest)).rejects.toMatchObject({
      name: "AiClientError",
      code: "INVALID_RESPONSE",
    } satisfies Partial<AiClientError>);
  });

  it("reports timeout without producing a simulation command", async () => {
    const fetch: AiFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason);
        });
      });
    const client = createAiClient({ fetch, timeoutMs: 1 });

    await expect(client.proposeCard(cardRequest)).rejects.toMatchObject({
      name: "AiClientError",
      code: "TIMEOUT",
    } satisfies Partial<AiClientError>);
  });

  it("reports a network failure as a typed client error", async () => {
    const client = createAiClient({
      fetch: async () => {
        throw new TypeError("network unreachable");
      },
    });

    await expect(client.proposeCard(cardRequest)).rejects.toMatchObject({
      name: "AiClientError",
      code: "NETWORK_ERROR",
    } satisfies Partial<AiClientError>);
  });
});
