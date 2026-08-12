import {
  artGenerateRequestSchema,
  type ArtGenerateRequest,
} from "@tcgtycoon/ai-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  OpenAIGenerativeProvider,
  OpenAIProviderError,
  type ImageGenerationRequest,
  type OpenAIClient,
  type StructuredResponseRequest,
} from "./openai-provider";

const artRequest: ArtGenerateRequest = artGenerateRequestSchema.parse({
  assetPurpose: "CARD_ART",
  visualBrief: {
    subject: "A brass hound assembled from enchanted salvage",
    composition: "Low heroic angle with the hound centered",
    styleKeywords: ["painterly", "industrial fantasy"],
    colorPalette: ["burnished brass", "smoke gray"],
  },
  referenceEntityIds: ["card-scrap-hound"],
});

function createFakeClient(
  generateImage: (input: ImageGenerationRequest) => Promise<{
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  }>,
): OpenAIClient {
  return {
    responses: {
      create: vi.fn(
        async (
          input: StructuredResponseRequest,
        ): Promise<{ output_text: string }> => {
          void input;
          throw new Error("Text generation is not expected in artwork tests");
        },
      ),
    },
    images: { generate: generateImage },
  };
}

describe("OpenAIGenerativeProvider artwork", () => {
  it("returns one PNG payload using the configured image model", async () => {
    const generate = vi.fn(async (input: ImageGenerationRequest) => {
      void input;
      return {
        data: [
          {
            b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
            revised_prompt: "A centered painterly brass salvage hound",
          },
        ],
      };
    });
    const provider = new OpenAIGenerativeProvider(createFakeClient(generate), {
      textModel: "gpt-text-test",
      imageModel: "gpt-image-configured",
    });

    await expect(provider.generateArtwork(artRequest)).resolves.toEqual({
      mediaType: "image/png",
      base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
      revisedPrompt: "A centered painterly brass salvage hound",
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith({
      model: "gpt-image-configured",
      prompt: expect.stringContaining(artRequest.visualBrief.subject),
      n: 1,
      output_format: "png",
    });
  });

  it("returns a typed failure when image generation is unavailable", async () => {
    const provider = new OpenAIGenerativeProvider(
      createFakeClient(async () => {
        throw new Error("upstream unavailable");
      }),
      { textModel: "gpt-text-test", imageModel: "gpt-image-configured" },
    );

    await expect(provider.generateArtwork(artRequest)).rejects.toMatchObject({
      name: "OpenAIProviderError",
      code: "PROVIDER_ERROR",
    } satisfies Partial<OpenAIProviderError>);
  });

  it("rejects an image response without exactly one base64 payload", async () => {
    const provider = new OpenAIGenerativeProvider(
      createFakeClient(async () => ({ data: [] })),
      { textModel: "gpt-text-test", imageModel: "gpt-image-configured" },
    );

    await expect(provider.generateArtwork(artRequest)).rejects.toMatchObject({
      name: "OpenAIProviderError",
      code: "INVALID_OUTPUT",
    } satisfies Partial<OpenAIProviderError>);
  });
});
