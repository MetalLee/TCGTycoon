import {
  printRunId,
  productId,
} from "../../../../../packages/domain/src/index";
import { createTestWorld } from "../../../../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";
import { selectOperationsView } from "./operations-model";

describe("operations calendar model", () => {
  it("includes due physical Print Runs even without a separate operation", () => {
    const world = createTestWorld("operations-print-run");
    world.day = 2;
    world.printRuns["print-run-reprint"] = {
      id: printRunId("print-run-reprint"),
      productId: productId("product-launch-booster"),
      sourceExpansionId: world.expansions["set-launch"]!.id,
      productKind: "BOOSTER",
      cardIds: [...world.products["product-launch-booster"]!.cardIds],
      orderedQuantity: 1_000,
      quantity: 0,
      orderedDay: 1,
      completionDay: 4,
      unitCost: 1,
      totalCost: 1_000,
      status: "PRINTING",
      printingIds: [],
    };

    expect(selectOperationsView(world).calendar).toContainEqual(
      expect.objectContaining({
        id: "print-run-reprint",
        day: 4,
        label: "Print run print-run-reprint",
        status: "PRINTING",
      }),
    );
  });
});
