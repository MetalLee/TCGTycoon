import {
  communityFactPacketSchema,
  communityRenderResponseSchema,
  type CommunityFactPacket,
  type CommunityRenderResponse,
} from "../../../../../packages/ai-contracts/src/index";
import type { CommunityPostIntent } from "../../../../../packages/sim-core/src/index";
import { defaultAiClient } from "./ai-client";

export type CommunityPresentation = Readonly<{
  intentId: string;
  text: string;
  source: "TEMPLATE" | "AI";
}>;

export interface CommunityPresentationHistory {
  get(intentId: string): CommunityPresentation | undefined;
  attach(presentation: CommunityPresentation): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
}

export function createCommunityPresentationHistory(): CommunityPresentationHistory {
  const presentations = new Map<string, CommunityPresentation>();
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    get: (intentId) => presentations.get(intentId),
    attach: (presentation) => {
      presentations.set(presentation.intentId, { ...presentation });
      version += 1;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => version,
  };
}

export function buildCommunityFactPacket(
  intent: CommunityPostIntent,
): CommunityFactPacket {
  return communityFactPacketSchema.parse({
    day: intent.day,
    agent: intent.author,
    knownFacts: intent.facts,
    recentMemories: intent.recentMemories,
    requestedTopic: intent.topic,
    requestedStance: intent.stance,
  });
}

export type CommunityRenderer = (
  request: CommunityFactPacket,
) => Promise<CommunityRenderResponse>;

export interface AiEnrichmentQueue {
  enqueue(intent: CommunityPostIntent): void;
  whenIdle(): Promise<void>;
}

export type AiEnrichmentQueueOptions = Readonly<{
  history: CommunityPresentationHistory;
  renderer: CommunityRenderer;
}>;

export function createAiEnrichmentQueue(
  options: AiEnrichmentQueueOptions,
): AiEnrichmentQueue {
  const pending = new Set<Promise<void>>();

  return {
    enqueue(intent) {
      options.history.attach({
        intentId: intent.id,
        text: intent.templateText,
        source: "TEMPLATE",
      });

      let request: CommunityFactPacket;
      try {
        request = buildCommunityFactPacket(intent);
      } catch {
        return;
      }

      let rendering: Promise<CommunityRenderResponse>;
      try {
        rendering = options.renderer(request);
      } catch {
        return;
      }

      const task = rendering
        .then((candidate) => {
          const rendered = communityRenderResponseSchema.parse(candidate);
          const allowedEntityIds = new Set(
            intent.facts.flatMap((fact) =>
              fact.entityId === undefined ? [] : [fact.entityId],
            ),
          );
          if (
            rendered.topic !== intent.topic ||
            rendered.stance !== intent.stance ||
            rendered.referencedEntityIds.some(
              (entityId) => !allowedEntityIds.has(entityId),
            )
          ) {
            return;
          }
          options.history.attach({
            intentId: intent.id,
            text: rendered.text,
            source: "AI",
          });
        })
        .catch(() => undefined)
        .finally(() => pending.delete(task));
      pending.add(task);
    },
    async whenIdle() {
      while (pending.size > 0) {
        await Promise.all([...pending]);
      }
    },
  };
}

export const communityPresentationHistory =
  createCommunityPresentationHistory();

export const defaultAiEnrichmentQueue = createAiEnrichmentQueue({
  history: communityPresentationHistory,
  renderer: (request) => defaultAiClient.renderCommunityPost(request),
});
