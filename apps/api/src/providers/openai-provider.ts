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
  type WorldAssistRequest,
  type WorldAssistResponse,
} from "@tcgtycoon/ai-contracts";
import { ZodError, type ZodType } from "zod";
import { buildArtworkPrompt } from "../prompts/art";
import {
  buildCardProposalPrompt,
  cardProposalJsonSchema,
} from "../prompts/card";
import {
  buildCommunityRenderPrompt,
  communityRenderJsonSchema,
} from "../prompts/community";
import {
  buildSetCompletionPrompt,
  setCompletionJsonSchema,
} from "../prompts/set";
import {
  buildWorldAssistPrompt,
  worldAssistJsonSchema,
} from "../prompts/world";
import type { GenerativeProvider } from "./types";

export type StructuredResponseRequest = {
  model: string;
  store: false;
  input: Array<{
    role: "developer" | "user";
    content: string;
  }>;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
};

export type OpenAIResponsesClient = {
  responses: {
    create(
      input: StructuredResponseRequest,
    ): PromiseLike<{ output_text: string }>;
  };
};

export type ImageGenerationRequest = {
  model: string;
  prompt: string;
  n: 1;
  output_format: "png";
};

type ImageGenerationResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
};

export type OpenAIClient = OpenAIResponsesClient & {
  images: {
    generate(
      input: ImageGenerationRequest,
    ): PromiseLike<ImageGenerationResponse>;
  };
};

export type OpenAIProviderConfig = {
  textModel: string;
  imageModel: string;
};

export type OpenAIProviderErrorCode =
  "INVALID_OUTPUT" | "PROVIDER_ERROR" | "UNSUPPORTED_CAPABILITY";

export class OpenAIProviderError extends Error {
  readonly code: OpenAIProviderErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: OpenAIProviderErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "OpenAIProviderError";
    this.code = code;
    this.cause = options?.cause;
  }
}

type TextOperation<T> = {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  prompt: string;
  responseSchema: ZodType<T>;
};

function validationSummary(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const path =
          issue.path.length === 0 ? "response" : issue.path.join(".");
        return `${path}: ${issue.message}`;
      })
      .join("; ");
  }

  if (error instanceof SyntaxError) {
    return `response: invalid JSON (${error.message})`;
  }

  return `response: ${String(error)}`;
}

export class OpenAIGenerativeProvider implements GenerativeProvider {
  constructor(
    private readonly client: OpenAIResponsesClient &
      Partial<Pick<OpenAIClient, "images">>,
    private readonly config: OpenAIProviderConfig,
  ) {}

  assistWorld(input: WorldAssistRequest): Promise<WorldAssistResponse> {
    return this.generateStructured({
      schemaName: "world_assist_response",
      jsonSchema: worldAssistJsonSchema,
      prompt: buildWorldAssistPrompt(input),
      responseSchema: worldAssistResponseSchema,
    });
  }

  proposeCard(input: CardProposalRequest): Promise<CardProposalResponse> {
    return this.generateStructured({
      schemaName: "card_proposal_response",
      jsonSchema: cardProposalJsonSchema,
      prompt: buildCardProposalPrompt(input),
      responseSchema: cardProposalResponseSchema,
    });
  }

  completeSet(input: SetCompletionRequest): Promise<SetCompletionResponse> {
    return this.generateStructured({
      schemaName: "set_completion_response",
      jsonSchema: setCompletionJsonSchema,
      prompt: buildSetCompletionPrompt(input),
      responseSchema: setCompletionResponseSchema,
    });
  }

  renderCommunityPost(
    input: CommunityRenderRequest,
  ): Promise<CommunityRenderResponse> {
    return this.generateStructured({
      schemaName: "community_render_response",
      jsonSchema: communityRenderJsonSchema,
      prompt: buildCommunityRenderPrompt(input),
      responseSchema: communityRenderResponseSchema,
    });
  }

  async generateArtwork(
    input: ArtGenerateRequest,
  ): Promise<ArtGenerateResponse> {
    if (this.client.images === undefined) {
      throw new OpenAIProviderError(
        "UNSUPPORTED_CAPABILITY",
        "The configured OpenAI client does not support image generation.",
      );
    }

    let response: ImageGenerationResponse;
    try {
      response = await this.client.images.generate({
        model: this.config.imageModel,
        prompt: buildArtworkPrompt(input),
        n: 1,
        output_format: "png",
      });
    } catch (error) {
      throw new OpenAIProviderError(
        "PROVIDER_ERROR",
        "OpenAI image generation request failed.",
        { cause: error },
      );
    }

    const image = response.data?.length === 1 ? response.data[0] : undefined;
    if (image?.b64_json === undefined || image.b64_json.length === 0) {
      throw new OpenAIProviderError(
        "INVALID_OUTPUT",
        "OpenAI image generation did not return exactly one base64 image.",
      );
    }

    try {
      return artGenerateResponseSchema.parse({
        mediaType: "image/png",
        base64Data: image.b64_json,
        ...(image.revised_prompt === undefined
          ? {}
          : { revisedPrompt: image.revised_prompt }),
      });
    } catch (error) {
      throw new OpenAIProviderError(
        "INVALID_OUTPUT",
        `OpenAI image output failed validation: ${validationSummary(error)}`,
        { cause: error },
      );
    }
  }

  private async generateStructured<T>(operation: TextOperation<T>): Promise<T> {
    let retrySummary: string | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const input: StructuredResponseRequest["input"] = [
        {
          role: "developer",
          content:
            "Return only JSON matching the supplied strict schema. Never invent unsupported TCG mechanics or facts outside the supplied input.",
        },
        { role: "user", content: operation.prompt },
      ];
      if (retrySummary !== undefined) {
        input.push({
          role: "user",
          content: `Validation failed: ${retrySummary}. Return corrected JSON without relaxing the schema.`,
        });
      }

      let outputText: string;
      try {
        const response = await this.client.responses.create({
          model: this.config.textModel,
          store: false,
          input,
          text: {
            format: {
              type: "json_schema",
              name: operation.schemaName,
              strict: true,
              schema: operation.jsonSchema,
            },
          },
        });
        outputText = response.output_text;
      } catch (error) {
        throw new OpenAIProviderError(
          "PROVIDER_ERROR",
          "OpenAI Responses API request failed.",
          { cause: error },
        );
      }

      try {
        const parsedJson: unknown = JSON.parse(outputText);
        return operation.responseSchema.parse(parsedJson);
      } catch (error) {
        retrySummary = validationSummary(error);
      }
    }

    throw new OpenAIProviderError(
      "INVALID_OUTPUT",
      `OpenAI output failed validation after two attempts: ${retrySummary ?? "unknown validation error"}`,
    );
  }
}
