import type { CardDefinition } from "./cards";
import type { CardId, ExpansionId, FactionId, OperationId } from "./ids";
import type { CardType, Rarity } from "./rules";

export const EXPANSION_SIZES = [24, 32, 36, 48] as const;

export type ExpansionSize = (typeof EXPANSION_SIZES)[number];

export type ExpansionBrief = {
  theme: string;
  focusFactionIds: FactionId[];
  strategicDirections: string[];
  productPositioning: string;
};

export type ExpansionProject = {
  id: ExpansionId;
  operationId: OperationId;
  name: string;
  size: ExpansionSize;
  createdDay: number;
  brief: ExpansionBrief;
  cardIds: CardId[];
};

export type ExpansionStage =
  "CONCEPT" | "DESIGN" | "PLAYTEST" | "FINALIZED" | "PRINTING" | "RELEASED";

export type PostLaunchExpansionSize = 24 | 32 | 36;

export type DesignSlotMetadata = {
  index: number;
  intendedFactionId: FactionId;
  intendedRarity: Rarity;
  intendedCardType: CardType;
};

export type CardDraftFlavor = {
  displayText: string;
  flavorText: string;
};

export type ExpansionCardDraft = {
  definition: CardDefinition;
  gameplayRevision: number;
  rulesLocked: boolean;
  slot: DesignSlotMetadata;
  flavor: CardDraftFlavor;
};

export type ExpansionPipelineProject = Omit<ExpansionProject, "size"> & {
  size: PostLaunchExpansionSize;
  stage: ExpansionStage;
  designProgressDays: number;
  designTargetDays: number;
  cardDrafts: Record<string, ExpansionCardDraft>;
  riskWarnings: string[];
  finalizedCards: Record<string, CardDefinition>;
};
