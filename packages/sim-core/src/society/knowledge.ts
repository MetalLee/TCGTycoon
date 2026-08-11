import type { KnowledgeState } from "@tcgtycoon/domain";

export function createEmptyKnowledgeState(): KnowledgeState {
  return {
    knownCardIds: [],
    knownDeckIds: [],
  };
}
