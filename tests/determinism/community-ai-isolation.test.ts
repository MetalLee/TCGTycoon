import {
  createAiEnrichmentQueue,
  createCommunityPresentationHistory,
} from "../../apps/game/src/services/ai/ai-enrichment-queue";
import { selectCommunityPosts } from "../../apps/game/src/selectors/community";
import { hashWorldState, simulateDay } from "../../packages/sim-core/src/index";
import { createBalancedWorld } from "../../packages/testkit/src/index";
import { describe, expect, it, vi } from "vitest";

describe("community AI isolation", () => {
  it("keeps canonical simulation results identical for different rendered prose", async () => {
    const scenario = createBalancedWorld("community-ai-isolation");
    const commands = [
      {
        type: "PUBLISH_ANNOUNCEMENT" as const,
        topic: "DEVELOPMENT" as const,
        text: "Development continues.",
      },
    ];
    const first = simulateDay(scenario.world, commands, scenario.balanceConfig);
    const second = simulateDay(
      createBalancedWorld("community-ai-isolation").world,
      commands,
      scenario.balanceConfig,
    );
    const otherWorld = createBalancedWorld("community-ai-other-world");
    const other = simulateDay(
      otherWorld.world,
      commands,
      otherWorld.balanceConfig,
    );
    const firstIntent = first.communityPostIntents[0];
    const secondIntent = second.communityPostIntents[0];
    if (firstIntent === undefined || secondIntent === undefined) {
      throw new Error("Expected a deterministic community post intent");
    }

    expect(secondIntent).toEqual(firstIntent);
    expect(other.communityPostIntents[0]?.id).not.toBe(firstIntent.id);
    expect(
      selectCommunityPosts(first.nextState).some(
        (post) => post.id === firstIntent.id,
      ),
    ).toBe(true);
    const firstHistory = createCommunityPresentationHistory();
    const secondHistory = createCommunityPresentationHistory();
    const firstQueue = createAiEnrichmentQueue({
      history: firstHistory,
      renderer: vi.fn(async (request) => ({
        topic: request.requestedTopic,
        stance: request.requestedStance,
        sentiment: firstIntent.sentiment,
        referencedEntityIds: [],
        text: "A measured assessment of today's competitive environment.",
      })),
    });
    const secondQueue = createAiEnrichmentQueue({
      history: secondHistory,
      renderer: vi.fn(async (request) => ({
        topic: request.requestedTopic,
        stance: request.requestedStance,
        sentiment: secondIntent.sentiment,
        referencedEntityIds: [],
        text: "A completely different but still valid community reaction!",
      })),
    });

    firstQueue.enqueue(firstIntent);
    secondQueue.enqueue(secondIntent);
    expect(firstHistory.get(firstIntent.id)?.text).toBe(
      firstIntent.templateText,
    );
    await Promise.all([firstQueue.whenIdle(), secondQueue.whenIdle()]);

    expect(firstHistory.get(firstIntent.id)?.text).not.toBe(
      secondHistory.get(secondIntent.id)?.text,
    );
    expect(first.stateHash).toBe(second.stateHash);
    expect(hashWorldState(first.nextState)).toBe(first.stateHash);
    expect(hashWorldState(second.nextState)).toBe(second.stateHash);
    expect(first.nextState.metrics).toEqual(second.nextState.metrics);
    expect(first.nextState.market.snapshots).toEqual(
      second.nextState.market.snapshots,
    );
    expect(first.nextState.players).toEqual(second.nextState.players);
    expect(first.nextState.meta).toEqual(second.nextState.meta);
  });
});
