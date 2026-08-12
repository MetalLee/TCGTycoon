import { MARKETING_CONFIG, type MarketingConfig } from "@tcgtycoon/balance";
import type {
  AnnouncementBoundAction,
  AnnouncementState,
  AnnouncementTopic,
  Commitment,
  CommitmentStatus,
  CommitmentType,
  OfficialAnnouncement,
  WorldEvent,
  WorldState,
} from "@tcgtycoon/domain";

export type {
  AnnouncementActionType,
  AnnouncementBoundAction,
  AnnouncementState,
  Commitment,
  CommitmentStatus,
  CommitmentType,
  OfficialAnnouncement,
} from "@tcgtycoon/domain";
export { ANNOUNCEMENT_ACTION_TYPES, COMMITMENT_TYPES } from "@tcgtycoon/domain";

export type PublishOfficialAnnouncementInput = {
  id: string;
  day: number;
  topic: AnnouncementTopic;
  text: string;
  boundAction: AnnouncementBoundAction;
  commitment?: Omit<Commitment, "status">;
};

type AnnouncementWorld = Pick<WorldState, "history" | "metrics">;

const FULFILLMENT_EVENT_TYPES: Readonly<Record<CommitmentType, string>> = {
  RELEASE_PRODUCT: "PRODUCT_RELEASED",
  COMPLETE_REPRINT: "REPRINT_COMPLETED",
  ENACT_POLICY: "POLICY_CHANGE_EFFECTIVE",
  RUN_TOURNAMENT: "TOURNAMENT_COMPLETED",
  FINALIZE_EXPANSION: "EXPANSION_FINALIZED",
};

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireDay(day: number, name: string): void {
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function requireNonEmpty(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty`);
  }
}

function recentLowImpactCount(
  state: AnnouncementState,
  day: number,
  config: MarketingConfig,
): number {
  const firstRecentDay = day - config.announcements.saturationLookbackDays + 1;
  return state.announcements.filter(
    (announcement) =>
      announcement.commitment === undefined &&
      announcement.day >= firstRecentDay &&
      announcement.day <= day,
  ).length;
}

function calculateAttention(
  state: AnnouncementState,
  input: PublishOfficialAnnouncementInput,
  config: MarketingConfig,
): number {
  const lowImpactCount = recentLowImpactCount(state, input.day, config);
  const saturationMultiplier = Math.max(
    config.announcements.minimumAttentionMultiplier,
    config.announcements.lowImpactDecayFactor ** lowImpactCount,
  );
  return Math.min(
    1,
    config.announcements.baseAttention * saturationMultiplier +
      (input.commitment === undefined
        ? 0
        : config.announcements.structuredCommitmentBonus),
  );
}

function createCommitment(
  state: AnnouncementState,
  input: PublishOfficialAnnouncementInput,
): Commitment | undefined {
  const commitment = input.commitment;
  if (commitment === undefined) {
    return undefined;
  }
  requireNonEmpty(commitment.id, "Commitment id");
  requireNonEmpty(commitment.subjectId, "Commitment subjectId");
  requireDay(commitment.dueDay, "Commitment dueDay");
  if (commitment.dueDay < input.day) {
    throw new RangeError("Commitment dueDay cannot precede announcement day");
  }
  if (
    state.announcements.some(
      (announcement) => announcement.commitment?.id === commitment.id,
    )
  ) {
    throw new Error(`Duplicate Commitment ID ${commitment.id}`);
  }
  return { ...commitment, status: "PENDING" };
}

export function createAnnouncementState(): AnnouncementState {
  return { announcements: [] };
}

export function publishOfficialAnnouncement(
  world: AnnouncementWorld,
  state: AnnouncementState,
  input: PublishOfficialAnnouncementInput,
  config: MarketingConfig = MARKETING_CONFIG,
): OfficialAnnouncement {
  requireNonEmpty(input.id, "Announcement id");
  requireDay(input.day, "Announcement day");
  requireNonEmpty(input.boundAction.subjectId, "Announcement subjectId");
  if (
    state.announcements.some((announcement) => announcement.id === input.id)
  ) {
    throw new Error(`Duplicate Official Announcement ID ${input.id}`);
  }
  const commitment = createCommitment(state, input);
  const announcement: OfficialAnnouncement = {
    id: input.id,
    day: input.day,
    topic: input.topic,
    text: input.text,
    boundAction: { ...input.boundAction },
    attention: calculateAttention(state, input, config),
    ...(commitment === undefined ? {} : { commitment }),
  };
  state.announcements.push(announcement);
  world.history.events.push({
    id: `official-announcement-${input.id}`,
    day: input.day,
    type: "OFFICIAL_ANNOUNCEMENT",
    context: {
      reason: `${input.boundAction.type}:${input.boundAction.subjectId}`,
      publicCommitment: commitment !== undefined,
      trustSignal: "NONE",
    },
  });
  return announcement;
}

function eventMatchesCommitment(
  event: WorldEvent,
  commitment: Commitment,
  announcementDay: number,
): boolean {
  if (
    event.type !== FULFILLMENT_EVENT_TYPES[commitment.type] ||
    event.day < announcementDay ||
    event.day > commitment.dueDay
  ) {
    return false;
  }
  if (
    commitment.type === "RELEASE_PRODUCT" ||
    commitment.type === "COMPLETE_REPRINT"
  ) {
    return event.context?.productId === commitment.subjectId;
  }
  const reason = event.context?.reason;
  if (reason === undefined) return false;
  if (commitment.type === "FINALIZE_EXPANSION") {
    return reason === commitment.subjectId;
  }
  if (commitment.type === "ENACT_POLICY") {
    return reason.split(":").includes(commitment.subjectId);
  }
  try {
    const result = JSON.parse(reason) as { tournamentId?: string };
    return result.tournamentId === commitment.subjectId;
  } catch {
    return false;
  }
}

function outcomeEvent(
  commitment: Commitment,
  day: number,
  status: Exclude<CommitmentStatus, "PENDING">,
): WorldEvent {
  const fulfilled = status === "FULFILLED";
  return {
    id: `commitment-${commitment.id}-${status.toLowerCase()}`,
    day,
    type: fulfilled ? "COMMITMENT_FULFILLED" : "COMMITMENT_BREACHED",
    context: {
      reason: commitment.id,
      publicCommitment: true,
      trustSignal: fulfilled ? "POSITIVE" : "NEGATIVE",
    },
  };
}

export function evaluateCommitments(
  state: AnnouncementState,
  worldEvents: readonly WorldEvent[],
  day: number,
): WorldEvent[] {
  requireDay(day, "day");
  const commitments = state.announcements
    .flatMap((announcement) =>
      announcement.commitment === undefined
        ? []
        : [
            {
              commitment: announcement.commitment,
              announcementDay: announcement.day,
            },
          ],
    )
    .filter(({ commitment }) => commitment.status === "PENDING")
    .sort((left, right) => compareIds(left.commitment.id, right.commitment.id));
  const outcomes: WorldEvent[] = [];

  for (const { commitment, announcementDay } of commitments) {
    const fulfillment = [...worldEvents]
      .filter((event) =>
        eventMatchesCommitment(event, commitment, announcementDay),
      )
      .sort(
        (left, right) => left.day - right.day || compareIds(left.id, right.id),
      )[0];
    if (fulfillment !== undefined) {
      commitment.status = "FULFILLED";
      outcomes.push(outcomeEvent(commitment, fulfillment.day, "FULFILLED"));
    } else if (day > commitment.dueDay) {
      commitment.status = "BREACHED";
      outcomes.push(outcomeEvent(commitment, day, "BREACHED"));
    }
  }
  return outcomes;
}
