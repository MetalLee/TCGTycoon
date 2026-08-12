import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE_CONFIG } from "./day-context";
import { createPublisherTestWorld } from "./publisher-test-world";
import { simulateDay } from "./simulate-day";

describe("publisher command lifecycle", () => {
  it("activates an emergency ban on the following game day", () => {
    const world = createPublisherTestWorld("emergency-policy-lifecycle");
    const target = Object.values(world.cards)[0]!;

    const scheduled = simulateDay(
      world,
      [{ type: "SCHEDULE_BAN", cardId: target.id, timing: "EMERGENCY" }],
      DEFAULT_BALANCE_CONFIG,
    );
    const activated = simulateDay(
      scheduled.nextState,
      [],
      DEFAULT_BALANCE_CONFIG,
    );

    expect(
      Object.values(activated.nextState.operations ?? {}).find(
        (operation) => operation.type === "POLICY_CHANGE",
      ),
    ).toMatchObject({
      status: "COMPLETED",
      payload: { kind: "BAN", cardId: target.id },
    });
  }, 30_000);
});
