import type { ReleaseConfig } from "@tcgtycoon/balance";
import {
  type ProductId,
  type ProductReleaseStatus,
  type WorldEvent,
  type WorldEventContext,
  type WorldState,
} from "@tcgtycoon/domain";
import { getAvailableProductInventory } from "./primary-market";

export type ReleaseStatus = ProductReleaseStatus;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireReleaseDay(world: WorldState, day: number): void {
  if (!Number.isInteger(day) || day < world.day) {
    throw new RangeError(
      "Release day must be the current or a future integer day",
    );
  }
}

function requireProduct(world: WorldState, productId: ProductId) {
  const product = world.products[productId];
  if (product === undefined) {
    throw new Error(`Unknown product ${productId}`);
  }
  return product;
}

function appendReleaseEvent(
  world: WorldState,
  type: string,
  context: WorldEventContext,
): WorldEvent {
  const event: WorldEvent = {
    id: `release-event-${world.day}-${String(
      world.history.events.length + 1,
    ).padStart(4, "0")}`,
    day: world.day,
    type,
    context: { ...context },
  };
  world.history.events.push(event);
  return event;
}

export function announceRelease(
  world: WorldState,
  productId: ProductId,
  releaseDay: number,
): WorldEvent {
  requireReleaseDay(world, releaseDay);
  const product = requireProduct(world, productId);
  if (product.releaseStatus === "LIVE") {
    throw new Error(`Live product ${productId} cannot be announced again`);
  }

  product.releaseStatus = "ANNOUNCED";
  product.internalReleaseDay = releaseDay;
  product.announcedReleaseDay = releaseDay;
  delete product.releasedDay;
  return appendReleaseEvent(world, "RELEASE_ANNOUNCED", {
    productId,
    newReleaseDay: releaseDay,
    publicCommitment: true,
    trustSignal: "NONE",
  });
}

export function rescheduleRelease(
  world: WorldState,
  productId: ProductId,
  newReleaseDay: number,
): WorldEvent[] {
  requireReleaseDay(world, newReleaseDay);
  const product = requireProduct(world, productId);
  if (product.releaseStatus === "LIVE") {
    throw new Error(`Live product ${productId} cannot be rescheduled`);
  }

  const previousReleaseDay = product.announcedReleaseDay;
  product.internalReleaseDay = newReleaseDay;
  if (
    product.releaseStatus === "UNANNOUNCED" ||
    previousReleaseDay === undefined
  ) {
    return [];
  }

  product.releaseStatus = "DELAYED";
  product.announcedReleaseDay = newReleaseDay;
  return [
    appendReleaseEvent(world, "RELEASE_DELAY", {
      productId,
      reason: "PUBLIC_RESCHEDULE",
      previousReleaseDay,
      newReleaseDay,
      publicCommitment: true,
      trustSignal: "NEGATIVE",
    }),
  ];
}

function validateReleaseConfig(config: ReleaseConfig): void {
  if (
    !Number.isInteger(config.shortSupplyThreshold) ||
    config.shortSupplyThreshold <= 0
  ) {
    throw new RangeError("shortSupplyThreshold must be a positive integer");
  }
}

export function executeReleasesDueToday(
  world: WorldState,
  config: ReleaseConfig,
): WorldEvent[] {
  validateReleaseConfig(config);
  const events: WorldEvent[] = [];
  const dueProducts = Object.values(world.products)
    .filter(
      (product) =>
        (product.releaseStatus === "ANNOUNCED" ||
          product.releaseStatus === "DELAYED") &&
        product.announcedReleaseDay !== undefined &&
        product.announcedReleaseDay <= world.day,
    )
    .sort((left, right) => compareIds(left.id, right.id));

  for (const product of dueProducts) {
    const availableInventory = getAvailableProductInventory(world, product.id);
    const committedReleaseDay = product.announcedReleaseDay!;
    if (availableInventory === 0) {
      if (product.releaseStatus !== "DELAYED") {
        product.releaseStatus = "DELAYED";
        events.push(
          appendReleaseEvent(world, "RELEASE_DELAY", {
            productId: product.id,
            reason: "ZERO_INVENTORY",
            previousReleaseDay: committedReleaseDay,
            publicCommitment: true,
            trustSignal: "NEGATIVE",
            availableInventory,
          }),
        );
      }
      continue;
    }

    product.releaseStatus = "LIVE";
    product.releasedDay = world.day;
    events.push(
      appendReleaseEvent(world, "PRODUCT_RELEASED", {
        productId: product.id,
        availableInventory,
        publicCommitment: true,
        trustSignal: "NONE",
      }),
    );
    if (availableInventory < config.shortSupplyThreshold) {
      events.push(
        appendReleaseEvent(world, "SHORT_SUPPLY_LAUNCH", {
          productId: product.id,
          availableInventory,
          shortSupplyThreshold: config.shortSupplyThreshold,
          publicCommitment: true,
          trustSignal: "NEGATIVE",
        }),
      );
    }
  }

  return events;
}
