import type { CardId, ExpansionId, FactionId, OperationId } from "./ids";

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
