import type { CampaignType } from "./community";
import type {
  CardId,
  ExpansionId,
  OperationId,
  PrintRunId,
  ProductId,
  TournamentId,
} from "./ids";

export type OperationStatus =
  "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED" | "DELAYED";

export type PlaytestTier = "QUICK" | "STANDARD" | "DEEP";

type OperationProjectBase<Type extends string, Payload> = {
  id: OperationId;
  type: Type;
  createdDay: number;
  startDay?: number;
  completionDay?: number;
  status: OperationStatus;
  progressDays: number;
  lastAdvancedDay?: number;
  payload: Payload;
};

export type OperationProject =
  | OperationProjectBase<"EXPANSION_DESIGN", { expansionId: ExpansionId }>
  | OperationProjectBase<
      "PLAYTEST",
      { expansionId: ExpansionId; tier: PlaytestTier }
    >
  | OperationProjectBase<
      "PRINT_RUN",
      { printRunId: PrintRunId; productId: ProductId }
    >
  | OperationProjectBase<"RELEASE", { productId: ProductId }>
  | OperationProjectBase<
      "POLICY_CHANGE",
      { kind: "BAN" | "RESTRICTION"; cardId: CardId }
    >
  | OperationProjectBase<"TOURNAMENT", { tournamentId: TournamentId }>
  | OperationProjectBase<"CAMPAIGN", { campaignType: CampaignType }>
  | OperationProjectBase<"ANNOUNCEMENT", { announcementId: string }>
  | OperationProjectBase<"MSRP_ADJUSTMENT", { productId: ProductId }>;

export type OperationScheduleRecord = {
  operationId: OperationId;
  startDay: number;
  completionDay?: number;
};
