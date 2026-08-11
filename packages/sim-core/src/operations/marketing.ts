import {
  MARKETING_CONFIG,
  type MarketingAudience,
  type MarketingConfig,
} from "@tcgtycoon/balance";
import {
  type CampaignDurationDays,
  type CampaignType,
  type OperationId,
  type OperationProject,
  type WorldState,
} from "@tcgtycoon/domain";
import type { LifecycleRates } from "../population/lifecycle";
import { getSellableProductInventory } from "../products/primary-market";
import { advanceScheduledOperations } from "./scheduler";

export type CampaignOperation = Extract<OperationProject, { type: "CAMPAIGN" }>;

export type ScheduleCampaignInput = {
  id: OperationId;
  campaignType: CampaignType;
  durationDays: CampaignDurationDays;
  createdDay: number;
  startDay: number;
};

export type CampaignExposureDelta = {
  campaignId: OperationId;
  campaignType: CampaignType;
  day: number;
  audience: MarketingAudience;
  exposureCount: number;
  potentialToInterestedRateDelta: number;
  interestedToNewRateDelta: number;
};

type CampaignScheduleWorld = Pick<WorldState, "operations" | "status">;
type CampaignExposureWorld = Pick<
  WorldState,
  "cohorts" | "operations" | "status"
>;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function requireDay(day: number, name: string): void {
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function totalCohortPopulation(world: CampaignExposureWorld): number {
  return world.cohorts.reduce((total, cohort) => {
    if (!Number.isInteger(cohort.count) || cohort.count < 0) {
      throw new RangeError(`Cohort ${cohort.id} count must be non-negative`);
    }
    return total + cohort.count;
  }, 0);
}

export function scheduleCampaign(
  world: CampaignScheduleWorld,
  input: ScheduleCampaignInput,
  config: MarketingConfig = MARKETING_CONFIG,
): CampaignOperation {
  requireDay(input.createdDay, "createdDay");
  requireDay(input.startDay, "startDay");
  if (input.startDay < input.createdDay) {
    throw new RangeError("Campaign startDay cannot precede createdDay");
  }
  if (!config.durationDays.includes(input.durationDays)) {
    throw new RangeError("Campaign duration must be 3, 7 or 14 days");
  }
  world.operations ??= {};
  if (world.operations[input.id] !== undefined) {
    throw new Error(`Duplicate Campaign ID ${input.id}`);
  }
  const operation: CampaignOperation = {
    id: input.id,
    type: "CAMPAIGN",
    createdDay: input.createdDay,
    startDay: input.startDay,
    completionDay: input.startDay + input.durationDays - 1,
    status: "PLANNED",
    progressDays: 0,
    payload: { campaignType: input.campaignType },
  };
  world.operations[input.id] = operation;
  return operation;
}

export function advanceCampaignExposure(
  world: CampaignExposureWorld,
  day: number,
  config: MarketingConfig = MARKETING_CONFIG,
): CampaignExposureDelta[] {
  requireDay(day, "day");
  const due = Object.values(world.operations ?? {})
    .filter((operation): operation is CampaignOperation => {
      return (
        operation.type === "CAMPAIGN" &&
        operation.startDay !== undefined &&
        operation.completionDay !== undefined &&
        operation.startDay <= day &&
        operation.completionDay >= day &&
        operation.lastAdvancedDay !== day &&
        operation.status !== "CANCELLED" &&
        operation.status !== "FAILED"
      );
    })
    .sort((left, right) => compareIds(left.id, right.id));
  advanceScheduledOperations(world, day);
  const population = totalCohortPopulation(world);

  return due.flatMap((operation) => {
    if (
      operation.lastAdvancedDay !== day ||
      (operation.status !== "ACTIVE" && operation.status !== "COMPLETED")
    ) {
      return [];
    }
    const campaign = config.campaigns[operation.payload.campaignType];
    return [
      {
        campaignId: operation.id,
        campaignType: operation.payload.campaignType,
        day,
        audience: campaign.audience,
        exposureCount: Math.round(population * campaign.dailyExposureRate),
        potentialToInterestedRateDelta: campaign.potentialToInterestedRateDelta,
        interestedToNewRateDelta: campaign.interestedToNewRateDelta,
      },
    ];
  });
}

function hasSellableStarter(world: WorldState): boolean {
  return Object.values(world.products)
    .filter(
      (product) =>
        product.kind === "STARTER" && product.releaseStatus === "LIVE",
    )
    .sort((left, right) => compareIds(left.id, right.id))
    .some((product) => getSellableProductInventory(world, product.id) > 0);
}

export function applyCampaignExposureToLifecycleRates(
  world: WorldState,
  baseRates: LifecycleRates,
  exposure: readonly CampaignExposureDelta[],
  config: MarketingConfig = MARKETING_CONFIG,
): LifecycleRates {
  const activeExposure = exposure.filter((delta) => delta.exposureCount > 0);
  const awarenessDelta = Math.min(
    config.maximumAwarenessRateDelta,
    activeExposure.reduce(
      (total, delta) => total + delta.potentialToInterestedRateDelta,
      0,
    ),
  );
  const conversionDelta = activeExposure.reduce(
    (total, delta) => total + delta.interestedToNewRateDelta,
    0,
  );
  const starterMultiplier = hasSellableStarter(world)
    ? 1
    : config.starterStockoutConversionMultiplier;

  return {
    ...baseRates,
    potentialToInterested: clampUnit(
      baseRates.potentialToInterested + awarenessDelta,
    ),
    interestedToNew:
      clampUnit(baseRates.interestedToNew + conversionDelta) *
      starterMultiplier,
  };
}
