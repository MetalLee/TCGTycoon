import type { CardId, Keyword, MatchId } from "@tcgtycoon/domain";
import type { ActionLogEntry, MatchSide } from "../replay/action-log";

export type CardInstance = {
  instanceId: string;
  cardId: CardId;
};

export type UnitInstance = CardInstance & {
  attack: number;
  health: number;
  maxHealth: number;
  keywords: Keyword[];
  summonedTurn: number;
  attacksThisTurn: number;
  lastAttackTurn: number;
};

export type MatchPlayerState = {
  heroHealth: number;
  deck: CardId[];
  hand: CardInstance[];
  board: UnitInstance[];
  discard: CardInstance[];
  maxMana: number;
  mana: number;
  fatigue: number;
};

export type BattleAction =
  | {
      type: "PLAY_CARD";
      side: MatchSide;
      cardInstanceId: string;
      targetId?: string;
    }
  | {
      type: "ATTACK";
      side: MatchSide;
      attackerId: string;
      targetId: string;
    }
  | { type: "END_TURN"; side: MatchSide };

export type MatchState = {
  matchId: MatchId;
  matchSeed: bigint;
  turnNumber: number;
  activeSide: MatchSide;
  players: { A: MatchPlayerState; B: MatchPlayerState };
  actionLog: ActionLogEntry[];
  winner: MatchSide | null;
  mulliganCompleted: { A: boolean; B: boolean };
  nextInstanceSequence: number;
  nextLogSequence: number;
};

export type { ActionLogEntry, MatchSide } from "../replay/action-log";
