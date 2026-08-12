import {
  cardProposalRequestSchema,
  cardProposalResponseSchema,
  communityRenderRequestSchema,
  communityRenderResponseSchema,
  setCompletionRequestSchema,
  setCompletionResponseSchema,
  worldAssistRequestSchema,
  worldAssistResponseSchema,
  type CardProposalRequest,
  type CardProposalResponse,
  type CommunityRenderRequest,
  type CommunityRenderResponse,
  type SetCompletionRequest,
  type SetCompletionResponse,
  type WorldAssistRequest,
  type WorldAssistResponse,
} from "../../../../../packages/ai-contracts/src/index";

export type AiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type AiClientErrorCode =
  "TIMEOUT" | "NETWORK_ERROR" | "HTTP_ERROR" | "INVALID_RESPONSE";

export class AiClientError extends Error {
  readonly code: AiClientErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: AiClientErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "AiClientError";
    this.code = code;
    this.cause = options?.cause;
  }
}

export interface AiClient {
  assistWorld(input: WorldAssistRequest): Promise<WorldAssistResponse>;
  proposeCard(input: CardProposalRequest): Promise<CardProposalResponse>;
  completeSet(input: SetCompletionRequest): Promise<SetCompletionResponse>;
  renderCommunityPost(
    input: CommunityRenderRequest,
  ): Promise<CommunityRenderResponse>;
}

type Schema<T> = {
  parse(value: unknown): T;
};

export type AiClientOptions = {
  baseUrl?: string;
  fetch?: AiFetch;
  timeoutMs?: number;
};

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function createAiClient(options: AiClientOptions = {}): AiClient {
  const baseUrl = options.baseUrl ?? "";
  const fetchImplementation =
    options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function post<Request, Response>(
    path: string,
    input: Request,
    requestSchema: Schema<Request>,
    responseSchema: Schema<Response>,
  ): Promise<Response> {
    const body = requestSchema.parse(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: globalThis.Response;
    try {
      response = await fetchImplementation(endpoint(baseUrl, path), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new AiClientError("TIMEOUT", "AI gateway request timed out.", {
          cause,
        });
      }
      throw new AiClientError(
        "NETWORK_ERROR",
        "AI gateway could not be reached.",
        { cause },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new AiClientError(
        "HTTP_ERROR",
        `AI gateway returned HTTP ${response.status}.`,
      );
    }

    let json: unknown;
    try {
      json = await response.json();
      return responseSchema.parse(json);
    } catch (cause) {
      throw new AiClientError(
        "INVALID_RESPONSE",
        "AI gateway returned an invalid response.",
        { cause },
      );
    }
  }

  return {
    assistWorld: (input) =>
      post(
        "/v1/world/assist",
        input,
        worldAssistRequestSchema,
        worldAssistResponseSchema,
      ),
    proposeCard: (input) =>
      post(
        "/v1/cards/propose",
        input,
        cardProposalRequestSchema,
        cardProposalResponseSchema,
      ),
    completeSet: (input) =>
      post(
        "/v1/sets/complete",
        input,
        setCompletionRequestSchema,
        setCompletionResponseSchema,
      ),
    renderCommunityPost: (input) =>
      post(
        "/v1/community/render",
        input,
        communityRenderRequestSchema,
        communityRenderResponseSchema,
      ),
  };
}

export const defaultAiClient = createAiClient();
