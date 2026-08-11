import { z } from "zod";
import { cardDefinitionSchema, type CardDefinition } from "./cards";
import {
  ANNOUNCEMENT_TOPICS,
  CAMPAIGN_DURATIONS,
  CAMPAIGN_TYPES,
  type AnnouncementTopic,
  type CampaignDurationDays,
  type CampaignType,
} from "./community";
import {
  EXPANSION_SIZES,
  type ExpansionBrief,
  type ExpansionSize,
} from "./expansions";
import {
  cardId,
  expansionId,
  factionId,
  productId,
  tournamentId,
  type CardId,
  type ExpansionId,
  type ProductId,
  type TournamentId,
} from "./ids";
import type { PlaytestTier } from "./operations";
import { TOURNAMENT_PRESETS, type TournamentPreset } from "./tournaments";

export type PolicyTiming = "SCHEDULED" | "EMERGENCY";

export type PublisherCommand =
  | {
      type: "CREATE_EXPANSION";
      expansionId: ExpansionId;
      name: string;
      size: ExpansionSize;
      brief: ExpansionBrief;
    }
  | {
      type: "UPDATE_EXPANSION_BRIEF";
      expansionId: ExpansionId;
      brief: ExpansionBrief;
    }
  | {
      type: "UPDATE_CARD_DRAFT";
      expansionId: ExpansionId;
      cardId: CardId;
      draft: CardDefinition;
    }
  | {
      type: "START_PLAYTEST";
      expansionId: ExpansionId;
      tier: PlaytestTier;
    }
  | { type: "FINALIZE_EXPANSION"; expansionId: ExpansionId }
  | { type: "ADJUST_MSRP"; productId: ProductId; newMsrp: number }
  | {
      type: "ORDER_PRINT_RUN";
      productId: ProductId;
      quantity: number;
    }
  | {
      type: "ANNOUNCE_RELEASE";
      productId: ProductId;
      releaseDay: number;
    }
  | {
      type: "SCHEDULE_RELEASE";
      productId: ProductId;
      releaseDay: number;
    }
  | {
      type: "RESCHEDULE_RELEASE";
      productId: ProductId;
      newReleaseDay: number;
    }
  | {
      type: "SCHEDULE_BAN";
      cardId: CardId;
      timing: PolicyTiming;
    }
  | {
      type: "SCHEDULE_RESTRICTION";
      cardId: CardId;
      timing: PolicyTiming;
    }
  | {
      type: "CREATE_TOURNAMENT";
      tournamentId: TournamentId;
      name: string;
      preset: TournamentPreset;
      eventDay: number;
    }
  | {
      type: "START_CAMPAIGN";
      campaignType: CampaignType;
      durationDays: CampaignDurationDays;
      startDay: number;
    }
  | {
      type: "PUBLISH_ANNOUNCEMENT";
      topic: AnnouncementTopic;
      text: string;
      subjectId?: string;
    };

const cardIdSchema = z.string().min(1).transform(cardId);
const expansionIdSchema = z.string().min(1).transform(expansionId);
const factionIdSchema = z.string().min(1).transform(factionId);
const productIdSchema = z.string().min(1).transform(productId);
const tournamentIdSchema = z.string().min(1).transform(tournamentId);
const daySchema = z.number().int().nonnegative();
const expansionBriefSchema = z
  .object({
    theme: z.string(),
    focusFactionIds: z.array(factionIdSchema),
    strategicDirections: z.array(z.string()),
    productPositioning: z.string(),
  })
  .strict();

export const publisherCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("CREATE_EXPANSION"),
      expansionId: expansionIdSchema,
      name: z.string().min(1),
      size: z.union(EXPANSION_SIZES.map((size) => z.literal(size))),
      brief: expansionBriefSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("UPDATE_EXPANSION_BRIEF"),
      expansionId: expansionIdSchema,
      brief: expansionBriefSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("UPDATE_CARD_DRAFT"),
      expansionId: expansionIdSchema,
      cardId: cardIdSchema,
      draft: cardDefinitionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("START_PLAYTEST"),
      expansionId: expansionIdSchema,
      tier: z.enum(["QUICK", "STANDARD", "DEEP"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("FINALIZE_EXPANSION"),
      expansionId: expansionIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("ADJUST_MSRP"),
      productId: productIdSchema,
      newMsrp: z.number().finite().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ORDER_PRINT_RUN"),
      productId: productIdSchema,
      quantity: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ANNOUNCE_RELEASE"),
      productId: productIdSchema,
      releaseDay: daySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("SCHEDULE_RELEASE"),
      productId: productIdSchema,
      releaseDay: daySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("RESCHEDULE_RELEASE"),
      productId: productIdSchema,
      newReleaseDay: daySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("SCHEDULE_BAN"),
      cardId: cardIdSchema,
      timing: z.enum(["SCHEDULED", "EMERGENCY"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("SCHEDULE_RESTRICTION"),
      cardId: cardIdSchema,
      timing: z.enum(["SCHEDULED", "EMERGENCY"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("CREATE_TOURNAMENT"),
      tournamentId: tournamentIdSchema,
      name: z.string().min(1),
      preset: z.enum(TOURNAMENT_PRESETS),
      eventDay: daySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("START_CAMPAIGN"),
      campaignType: z.enum(CAMPAIGN_TYPES),
      durationDays: z.union(
        CAMPAIGN_DURATIONS.map((duration) => z.literal(duration)),
      ),
      startDay: daySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("PUBLISH_ANNOUNCEMENT"),
      topic: z.enum(ANNOUNCEMENT_TOPICS),
      text: z.string(),
      subjectId: z.string().min(1).optional(),
    })
    .strict(),
]);

export function parsePublisherCommand(input: unknown): PublisherCommand {
  return publisherCommandSchema.parse(input) as PublisherCommand;
}

export function parsePublisherCommands(
  input: readonly unknown[],
): PublisherCommand[] {
  return input.map(parsePublisherCommand);
}
