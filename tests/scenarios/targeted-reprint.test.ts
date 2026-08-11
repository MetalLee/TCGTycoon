import {
  cardId,
  expansionId,
  playerId,
  printRunId,
  productId,
  type ProductSku,
} from "../../packages/domain/src/index";
import { DeterministicRng } from "../../packages/rules-engine/src/index";
import {
  advancePrintRuns,
  countWorldSupply,
  createTargetedReprintPrinting,
  openStarter,
  orderPrintRun,
  resolvePrimarySales,
} from "../../packages/sim-core/src/index";
import {
  createBalancedWorld,
  launchBoosterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

describe("targeted reprint scenario", () => {
  it("creates physical reprint supply only through producing, selling and opening the later product", () => {
    const scenario = createBalancedWorld("targeted-reprint");
    const world = scenario.world;
    const source = Object.values(world.printings).find(
      (printing) =>
        printing.sourceProductId === launchBoosterProductId &&
        printing.edition === "FIRST_EDITION",
    )!;
    const targetExpansionId = expansionId("set-targeted-reprint");
    const targetProductId = productId("product-targeted-reprint-starter");
    const nativeCardId = cardId("card-targeted-reprint-native");
    world.cards[nativeCardId] = {
      ...world.cards[source.cardId]!,
      id: nativeCardId,
      name: "Targeted Reprint Native Card",
    };
    const targetProduct: ProductSku = {
      id: targetProductId,
      expansionId: targetExpansionId,
      name: "Targeted Reprint Starter",
      kind: "STARTER",
      msrp: 10,
      cardIds: [source.cardId, nativeCardId],
      releaseStatus: "LIVE",
      internalReleaseDay: world.day,
      releasedDay: world.day,
    };
    world.expansions[targetExpansionId] = {
      id: targetExpansionId,
      name: "Targeted Reprint Set",
    };
    world.products[targetProductId] = targetProduct;

    const targeted = createTargetedReprintPrinting(
      world,
      source.id,
      targetProductId,
    );
    expect(countWorldSupply(world, targeted.id)).toBe(0);

    const run = orderPrintRun(
      world,
      {
        id: printRunId("print-run-targeted-reprint"),
        productId: targetProductId,
        quantity: 2,
      },
      scenario.balanceConfig.production,
    );
    advancePrintRuns(world, run.completionDay);
    expect(world.printRuns[run.id]!.printingIds).toContain(targeted.id);
    const nativePrinting = world.printRuns[run.id]!.printingIds.map(
      (id) => world.printings[id]!,
    ).find((printing) => printing.cardId === nativeCardId)!;
    expect(nativePrinting.edition).toBe("FIRST_EDITION");
    expect(countWorldSupply(world, targeted.id)).toBe(0);

    const buyerId = playerId("player-0001");
    const sale = resolvePrimarySales(
      world,
      [{ buyerId, productId: targetProductId, quantity: 1 }],
      new DeterministicRng(1n),
    );
    expect(sale.openingRequests).toEqual([
      expect.objectContaining({
        buyerId,
        productId: targetProductId,
        printRunId: run.id,
        quantity: 1,
        printingIds: expect.arrayContaining([targeted.id, nativePrinting.id]),
      }),
    ]);
    openStarter(
      world,
      targetProductId,
      buyerId,
      [
        ...Array.from({ length: 10 }, () => targeted.id),
        ...Array.from({ length: 10 }, () => nativePrinting.id),
      ],
      sale.openingRequests[0]!.printingIds,
    );

    expect(countWorldSupply(world, targeted.id)).toBe(10);
    expect(world.printings[source.id]).toMatchObject({
      edition: "FIRST_EDITION",
      cardId: targeted.cardId,
    });
    expect(world.printings[targeted.id]).toMatchObject({
      edition: "REPRINT",
      cardId: source.cardId,
    });
  });
});
