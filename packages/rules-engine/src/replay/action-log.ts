import type { CardId } from "@tcgtycoon/domain";

export type MatchSide = "A" | "B";

type ActionLogEntryBase = {
  sequence: number;
  turn: number;
  side: MatchSide;
};

export type ActionLogEntry =
  | (ActionLogEntryBase & {
      type: "CARD_DRAWN" | "CARD_BURNED" | "COIN_ADDED";
      cardId: CardId;
      instanceId: string;
    })
  | (ActionLogEntryBase & {
      type: "FATIGUE_DAMAGE";
      amount: number;
    })
  | (ActionLogEntryBase & {
      type: "TURN_STARTED";
      maxMana: number;
    })
  | (ActionLogEntryBase & {
      type: "TURN_ENDED";
    })
  | (ActionLogEntryBase & {
      type: "MULLIGAN";
      returnedCardIds: CardId[];
      replacementCardIds: CardId[];
    });
