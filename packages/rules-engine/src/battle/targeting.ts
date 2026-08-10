import type { CardId, TargetSelector } from "@tcgtycoon/domain";
import type { MatchSide, MatchState, UnitInstance } from "./types";

export type EffectSource = {
  side: MatchSide;
  instanceId: string;
  cardId: CardId;
};

export type LocatedUnit = {
  side: MatchSide;
  unit: UnitInstance;
};

export function opposingSide(side: MatchSide): MatchSide {
  return side === "A" ? "B" : "A";
}

export function heroTargetId(side: MatchSide): string {
  return `hero:${side}`;
}

export function heroSideFromTarget(targetId: string): MatchSide | null {
  if (targetId === heroTargetId("A")) {
    return "A";
  }
  if (targetId === heroTargetId("B")) {
    return "B";
  }
  return null;
}

export function findUnit(
  state: MatchState,
  instanceId: string,
): LocatedUnit | undefined {
  for (const side of ["A", "B"] as const) {
    const unit = state.players[side].board.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    if (unit !== undefined) {
      return { side, unit };
    }
  }
  return undefined;
}

function selectableEnemyUnits(
  state: MatchState,
  source: EffectSource,
): UnitInstance[] {
  return state.players[opposingSide(source.side)].board.filter(
    (unit) => !unit.keywords.includes("STEALTH"),
  );
}

export function getLegalTargets(
  state: MatchState,
  source: EffectSource,
  selector: TargetSelector,
): string[] {
  const friendlyUnits = state.players[source.side].board;
  const enemyUnits = selectableEnemyUnits(state, source);
  const friendlyUnitIds = friendlyUnits.map((unit) => unit.instanceId);
  const enemyUnitIds = enemyUnits.map((unit) => unit.instanceId);

  switch (selector) {
    case "SELF":
      return findUnit(state, source.instanceId) === undefined
        ? []
        : [source.instanceId];
    case "FRIENDLY_UNIT":
    case "RANDOM_FRIENDLY_UNIT":
    case "ALL_FRIENDLY_UNITS":
      return friendlyUnitIds;
    case "ENEMY_UNIT":
    case "RANDOM_ENEMY_UNIT":
    case "ALL_ENEMY_UNITS":
      return enemyUnitIds;
    case "ANY_UNIT":
      return [...friendlyUnitIds, ...enemyUnitIds];
    case "FRIENDLY_HERO":
      return [heroTargetId(source.side)];
    case "ENEMY_HERO":
      return [heroTargetId(opposingSide(source.side))];
    case "ANY_CHARACTER":
      return [
        ...friendlyUnitIds,
        ...enemyUnitIds,
        heroTargetId(source.side),
        heroTargetId(opposingSide(source.side)),
      ];
  }
}
