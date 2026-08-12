import { cardId, operationId } from "../../../../packages/domain/src/index";
import { createTestWorld } from "../../../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";
import { selectCards } from "./cards";

describe("card selectors", () => {
  it("derives banned legality from a completed canonical policy operation", () => {
    const world = createTestWorld("card-policy-selector");
    const target = Object.values(world.cards)[0]!;
    const id = operationId("policy-ban-card");
    world.operations = {
      [id]: {
        id,
        type: "POLICY_CHANGE",
        createdDay: 1,
        startDay: 2,
        completionDay: 2,
        status: "COMPLETED",
        progressDays: 1,
        payload: { kind: "BAN", cardId: cardId(target.id) },
      },
    };

    expect(selectCards(world, { legality: "BANNED" }, "NAME")).toEqual([
      expect.objectContaining({ id: target.id, legality: "BANNED" }),
    ]);
  });

  it("treats a zero minimum market price as no lower bound", () => {
    const world = createTestWorld("card-zero-market-filter");

    expect(selectCards(world, { minimumMarketPrice: 0 }, "NAME")).toHaveLength(
      Object.keys(world.cards).length,
    );
  });
});
