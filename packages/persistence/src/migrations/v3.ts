import { z } from "zod";
import type { SaveEnvelopeV2 } from "./v2";
import { worldStateV3Schema } from "./world-state-schemas";

export const saveEnvelopeV3Schema = z
  .object({
    saveId: z.string().min(1),
    schemaVersion: z.literal(3),
    simulationVersion: z.string().min(1),
    ruleVersion: z.string().min(1),
    balanceVersion: z.string().min(1),
    appVersion: z.string().min(1),
    worldSeed: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    state: worldStateV3Schema,
  })
  .strict()
  .superRefine((save, context) => {
    for (const key of [
      "simulationVersion",
      "ruleVersion",
      "balanceVersion",
      "worldSeed",
    ] as const) {
      if (save[key] !== save.state[key]) {
        context.addIssue({
          code: "custom",
          path: ["state", key],
          message: `Envelope ${key} must match state ${key}.`,
        });
      }
    }
  });

export type SaveEnvelopeV3 = z.infer<typeof saveEnvelopeV3Schema>;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function legacyProductId(expansionId: string): string {
  return `product-legacy-${expansionId}`;
}

export function migrateV2ToV3(save: SaveEnvelopeV2): SaveEnvelopeV3 {
  const products: Record<
    string,
    SaveEnvelopeV2["state"]["products"][string] & { cardIds: string[] }
  > = {};
  const sourceProductsByExpansion = new Map<string, string[]>();
  for (const product of Object.values(save.state.products).sort((left, right) =>
    compareIds(left.id, right.id),
  )) {
    const cardIds = [
      ...new Set(
        Object.values(save.state.printings)
          .filter((printing) => printing.expansionId === product.expansionId)
          .map((printing) => printing.cardId),
      ),
    ].sort(compareIds);
    products[product.id] = { ...product, cardIds };
    const sources = sourceProductsByExpansion.get(product.expansionId) ?? [];
    sources.push(product.id);
    sourceProductsByExpansion.set(product.expansionId, sources);
  }

  for (const expansion of Object.values(save.state.expansions).sort(
    (left, right) => compareIds(left.id, right.id),
  )) {
    if ((sourceProductsByExpansion.get(expansion.id)?.length ?? 0) > 0) {
      continue;
    }
    const cardIds = [
      ...new Set(
        Object.values(save.state.printings)
          .filter((printing) => printing.expansionId === expansion.id)
          .map((printing) => printing.cardId),
      ),
    ].sort(compareIds);
    if (cardIds.length === 0) {
      continue;
    }
    let id = legacyProductId(expansion.id);
    let suffix = 1;
    while (products[id] !== undefined) {
      id = `${legacyProductId(expansion.id)}-${suffix}`;
      suffix += 1;
    }
    products[id] = {
      id,
      expansionId: expansion.id,
      name: `Legacy ${expansion.name} Product`,
      kind: "BOOSTER",
      msrp: 0,
      cardIds,
    };
    sourceProductsByExpansion.set(expansion.id, [id]);
  }

  type MigratedPrinting = {
    id: string;
    cardId: string;
    expansionId: string;
    edition: "FIRST_EDITION" | "UNLIMITED" | "REPRINT";
    sourceProductId: string;
    sourceExpansionId: string;
  };
  const printings: Record<string, MigratedPrinting> = Object.fromEntries(
    Object.values(save.state.printings)
      .sort((left, right) => compareIds(left.id, right.id))
      .map((printing) => {
        const sourceProductId = sourceProductsByExpansion
          .get(printing.expansionId)
          ?.sort(compareIds)[0];
        if (sourceProductId === undefined) {
          throw new Error(
            `Cannot migrate Printing ${printing.id} without a source Product`,
          );
        }
        return [
          printing.id,
          {
            ...printing,
            edition: "FIRST_EDITION" as const,
            sourceProductId,
            sourceExpansionId: printing.expansionId,
          },
        ];
      }),
  );

  function ensurePrintingIds(
    productId: string,
    edition: "FIRST_EDITION" | "UNLIMITED",
  ): string[] {
    const existing = Object.values(printings)
      .filter(
        (printing) =>
          printing.sourceProductId === productId &&
          printing.edition === edition,
      )
      .map((printing) => printing.id)
      .sort(compareIds);
    const product = products[productId];
    if (product === undefined || product.cardIds.length === 0) {
      return existing;
    }
    const existingCardIds = new Set(
      existing.map((id) => printings[id]!.cardId),
    );
    for (const cardId of product.cardIds) {
      if (existingCardIds.has(cardId)) {
        continue;
      }
      const id = `printing-${productId}-${cardId}-${edition
        .toLowerCase()
        .replaceAll("_", "-")}-normal`;
      printings[id] = {
        id,
        cardId,
        expansionId: product.expansionId,
        edition,
        sourceProductId: product.id,
        sourceExpansionId: product.expansionId,
      };
    }
    return Object.values(printings)
      .filter(
        (printing) =>
          printing.sourceProductId === productId &&
          printing.edition === edition,
      )
      .map((printing) => printing.id)
      .sort(compareIds);
  }

  const completedProducts = new Set<string>();
  const printRuns = Object.fromEntries(
    Object.values(save.state.printRuns)
      .sort(
        (left, right) =>
          left.completionDay - right.completionDay ||
          compareIds(left.id, right.id),
      )
      .map((run) => {
        const completed = run.completionDay <= save.state.day;
        const edition = completed
          ? completedProducts.has(run.productId)
            ? ("UNLIMITED" as const)
            : ("FIRST_EDITION" as const)
          : undefined;
        if (completed) {
          completedProducts.add(run.productId);
        }
        const printingIds =
          edition === undefined
            ? []
            : ensurePrintingIds(run.productId, edition);
        return [
          run.id,
          {
            ...run,
            orderedQuantity: run.quantity,
            quantity: completed ? run.quantity : 0,
            orderedDay: 0,
            unitCost: 0,
            totalCost: 0,
            status: completed ? ("COMPLETED" as const) : ("PRINTING" as const),
            ...(edition === undefined ? {} : { edition }),
            printingIds,
          },
        ];
      }),
  );

  return parseSaveEnvelopeV3({
    ...save,
    schemaVersion: 3,
    state: {
      ...save.state,
      schemaVersion: 3,
      products,
      printings,
      printRuns,
    },
  });
}

export function parseSaveEnvelopeV3(input: unknown): SaveEnvelopeV3 {
  return saveEnvelopeV3Schema.parse(input);
}
