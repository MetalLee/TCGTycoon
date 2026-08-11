import { dealDamage } from "./effects";
import {
  enqueueTriggers,
  resolveTriggerQueue,
  type ResolutionContext,
} from "./triggers";
import {
  findUnit,
  heroSideFromTarget,
  heroTargetId,
  opposingSide,
  type EffectSource,
} from "./targeting";
import type { MatchSide, UnitInstance } from "./types";

function unitSource(side: MatchSide, unit: UnitInstance): EffectSource {
  return { side, instanceId: unit.instanceId, cardId: unit.cardId };
}

export function checkStateBasedDeaths(ctx: ResolutionContext): void {
  const deaths: { side: MatchSide; unit: UnitInstance }[] = [];
  for (const side of ["A", "B"] as const) {
    const player = ctx.state.players[side];
    const survivors: UnitInstance[] = [];
    for (const unit of player.board) {
      if (unit.health <= 0) {
        deaths.push({ side, unit });
      } else {
        survivors.push(unit);
      }
    }
    player.board = survivors;
  }

  if (deaths.length === 0) {
    return;
  }

  const pendingAftermath = ctx.queue.splice(0);
  for (const death of deaths) {
    ctx.state.players[death.side].discard.push({
      instanceId: death.unit.instanceId,
      cardId: death.unit.cardId,
    });
    const source = unitSource(death.side, death.unit);
    if (death.unit.keywords.includes("DEATHRATTLE")) {
      enqueueTriggers(ctx, { type: "ON_DEATH", source });
    }
    enqueueTriggers(ctx, { type: "UNIT_DIED", source });
  }
  ctx.queue.push(...pendingAftermath);
}

function resetAttackCounterForTurn(
  unit: UnitInstance,
  turnNumber: number,
): void {
  if (unit.lastAttackTurn !== turnNumber) {
    unit.attacksThisTurn = 0;
    unit.lastAttackTurn = turnNumber;
  }
}

function legalAttackTargets(
  ctx: ResolutionContext,
  attackerSide: MatchSide,
): string[] {
  const enemySide = opposingSide(attackerSide);
  const visibleEnemies = ctx.state.players[enemySide].board.filter(
    (unit) => !unit.keywords.includes("STEALTH"),
  );
  const taunts = visibleEnemies.filter((unit) => unit.keywords.includes("TAUNT"));
  if (taunts.length > 0) {
    return taunts.map((unit) => unit.instanceId);
  }
  return [
    ...visibleEnemies.map((unit) => unit.instanceId),
    heroTargetId(enemySide),
  ];
}

export function performAttack(
  ctx: ResolutionContext,
  attackerId: string,
  targetId: string,
): void {
  const locatedAttacker = findUnit(ctx.state, attackerId);
  if (locatedAttacker === undefined) {
    throw new RangeError(`Attacker ${attackerId} does not exist.`);
  }
  const { side: attackerSide, unit: attacker } = locatedAttacker;
  if (attackerSide !== ctx.state.activeSide) {
    throw new RangeError(`Side ${attackerSide} is not the active side.`);
  }

  resetAttackCounterForTurn(attacker, ctx.state.turnNumber);
  const attackLimit = attacker.keywords.includes("WINDFURY") ? 2 : 1;
  if (attacker.attacksThisTurn >= attackLimit) {
    throw new RangeError(`Attacker ${attackerId} has reached its attack limit.`);
  }

  const targetHeroSide = heroSideFromTarget(targetId);
  const enteredPlayThisTurn = attacker.summonedTurn === ctx.state.turnNumber;
  if (enteredPlayThisTurn && !attacker.keywords.includes("CHARGE")) {
    if (attacker.keywords.includes("RUSH") && targetHeroSide !== null) {
      throw new RangeError("A Rush unit cannot attack the enemy hero immediately.");
    }
    if (!attacker.keywords.includes("RUSH")) {
      throw new RangeError("A newly summoned unit cannot attack this turn.");
    }
  }

  if (!legalAttackTargets(ctx, attackerSide).includes(targetId)) {
    throw new RangeError(`Target ${targetId} is not a legal attack target.`);
  }

  const defender = findUnit(ctx.state, targetId);
  if (defender !== undefined && defender.side === attackerSide) {
    throw new RangeError(`Target ${targetId} is not an enemy.`);
  }

  ctx.state.actionLog.push({
    sequence: ctx.state.nextLogSequence++,
    turn: ctx.state.turnNumber,
    side: attackerSide,
    type: "ATTACK",
    attackerId,
    targetId,
  });
  attacker.keywords = attacker.keywords.filter(
    (keyword) => keyword !== "STEALTH",
  );
  attacker.attacksThisTurn += 1;
  attacker.lastAttackTurn = ctx.state.turnNumber;

  const attackerSource = unitSource(attackerSide, attacker);
  const attackerDamage = attacker.attack;
  const defenderDamage = defender?.unit.attack ?? 0;
  const defenderSource =
    defender === undefined ? undefined : unitSource(defender.side, defender.unit);

  dealDamage(ctx, attackerSource, targetId, attackerDamage);
  if (defender !== undefined && defenderSource !== undefined) {
    dealDamage(ctx, defenderSource, attacker.instanceId, defenderDamage);
  }
  enqueueTriggers(ctx, {
    type: "AFTER_ATTACK",
    source: attackerSource,
    targetId,
  });
  checkStateBasedDeaths(ctx);
  resolveTriggerQueue(ctx);
  checkStateBasedDeaths(ctx);
}
