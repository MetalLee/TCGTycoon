import { describe, expect, it } from "vitest";
import { cardId, deckId } from "./ids";

describe("domain ids", () => {
  it("preserves stable string identity without generating randomness", () => {
    expect(cardId("card-fire-cub")).toBe("card-fire-cub");
    expect(deckId("deck-fire-aggro-v1")).toBe("deck-fire-aggro-v1");
  });
});
