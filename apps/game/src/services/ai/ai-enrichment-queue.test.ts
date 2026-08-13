// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { agentId } from "../../../../../packages/domain/src/index";
import type { CommunityPostIntent } from "../../../../../packages/sim-core/src/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityFeed } from "../../features/community/CommunityFeed";
import {
  buildCommunityFactPacket,
  createAiEnrichmentQueue,
  createCommunityPresentationHistory,
} from "./ai-enrichment-queue";

const intent: CommunityPostIntent = {
  id: "community-intent-day-12-agent-mika",
  day: 12,
  category: "COMPETITIVE",
  author: {
    id: agentId("agent-mika"),
    name: "Mika Vale",
    role: "BREWER",
    personalityTraits: ["curious", "direct"],
    riskTolerance: 0.7,
    brandAttitude: -0.2,
    influence: 0.6,
  },
  topic: "Grave Loop's current Meta presence",
  stance: "CONCERNED",
  sentiment: -0.2,
  facts: [
    {
      kind: "META_USAGE",
      entityId: "deck-grave-loop",
      statement: "Grave Loop reached 18% observed usage.",
    },
  ],
  recentMemories: ["Lost a Regional final to Grave Loop."],
  influence: 0.6,
  socialImpact: {
    positiveAttention: 0.6,
    negativeAttention: 0,
    sentimentTarget: 40,
  },
  templateText:
    "Mika Vale expressed concern about Grave Loop's current Meta presence.",
};

afterEach(cleanup);

describe("AI community enrichment queue", () => {
  it("attaches template text immediately and replaces it by stable intent ID", async () => {
    const history = createCommunityPresentationHistory();
    const renderer = vi.fn(async () => ({
      topic: intent.topic,
      stance: intent.stance,
      sentiment: intent.sentiment,
      referencedEntityIds: ["deck-grave-loop"],
      text: "Grave Loop is everywhere, and Mika wants answers.",
    }));
    const queue = createAiEnrichmentQueue({ history, renderer });

    queue.enqueue(intent);

    expect(history.get(intent.id)).toEqual({
      intentId: intent.id,
      text: intent.templateText,
      source: "TEMPLATE",
    });
    expect(renderer).toHaveBeenCalledWith(buildCommunityFactPacket(intent));

    await queue.whenIdle();

    expect(history.get(intent.id)).toEqual({
      intentId: intent.id,
      text: "Grave Loop is everywhere, and Mika wants answers.",
      source: "AI",
    });
  });

  it("retains deterministic fallback text when rendering fails", async () => {
    const history = createCommunityPresentationHistory();
    const queue = createAiEnrichmentQueue({
      history,
      renderer: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    queue.enqueue(intent);
    await expect(queue.whenIdle()).resolves.toBeUndefined();

    expect(history.get(intent.id)).toMatchObject({
      text: intent.templateText,
      source: "TEMPLATE",
    });
  });

  it("renders cached enrichment without changing the structured post", () => {
    const history = createCommunityPresentationHistory();
    history.attach({
      intentId: intent.id,
      text: intent.templateText,
      source: "TEMPLATE",
    });
    const post = {
      id: intent.id,
      day: intent.day,
      category: intent.category,
      sourceAgentId: intent.author.id,
      templateText: intent.templateText,
      links: [],
    } as const;
    const view = render(
      createElement(
        MemoryRouter,
        null,
        createElement(CommunityFeed, {
          posts: [post],
          presentationHistory: history,
        }),
      ),
    );

    expect(screen.getByText(intent.templateText)).toBeTruthy();

    act(() => {
      history.attach({
        intentId: intent.id,
        text: "Mika's rendered community post.",
        source: "AI",
      });
    });

    expect(screen.getByText("Mika's rendered community post.")).toBeTruthy();
    expect(intent.templateText).toBe(
      "Mika Vale expressed concern about Grave Loop's current Meta presence.",
    );
    view.unmount();
  });
});
