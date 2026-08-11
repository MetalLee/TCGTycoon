import { RULES_CONFIG } from "@tcgtycoon/balance";
import type { CardEffect, CardId, TargetSelector } from "@tcgtycoon/domain";
import { DeterministicRng, deriveSeed } from "../rng/deterministic-rng";
import { checkStateBasedDeaths } from "./state-check";
import {
  appendInfiniteComboWarning,
  enqueueTriggers,
  getSourceUnit,
  type ResolutionContext,
} from "./triggers";
import {
  findUnit,
  getLegalTargets,
  heroSideFromTarget,
  type EffectSource,
} from "./targeting";
import { drawCard } from "./turn";
import type { CardInstance, MatchSide, UnitInstance } from "./types";

type DamageResult = {
  actualDamage: number;
  preventedDamage: number;
};

function beginEffect(ctx: ResolutionContext): boolean {
  if (ctx.actionCount >= RULES_CONFIG.maxActionsPerChain) {
    appendInfiniteComboWarning(ctx, "ACTIONS");
    return false;
  }
  ctx.actionCount += 1;
  return true;
}

function chooseRandomTarget(
  ctx: ResolutionContext,
  selector: TargetSelector,
  targets: string[],
): string | undefined {
  if (targets.length === 0) {
    return undefined;
  }
  const rng = new DeterministicRng(
    deriveSeed([
      "effect-target",
      ctx.state.matchSeed.toString(),
      ctx.source.instanceId,
      selector,
      ctx.actionCount,
    ]),
  );
  return targets[rng.nextInt(targets.length)];
}

function effectTargets(
  ctx: ResolutionContext,
  selector: TargetSelector,
): string[] {
  const legalTargets = getLegalTargets(ctx.state, ctx.source, selector);
  if (
    selector === "ALL_FRIENDLY_UNITS" ||
    selector === "ALL_ENEMY_UNITS"
  ) {
    return legalTargets;
  }
  if (
    selector === "RANDOM_FRIENDLY_UNIT" ||
    selector === "RANDOM_ENEMY_UNIT"
  ) {
    const target = chooseRandomTarget(ctx, selector, legalTargets);
    return target === undefined ? [] : [target];
  }
  if (ctx.selectedTargetId !== undefined) {
    if (legalTargets.includes(ctx.selectedTargetId)) {
      return [ctx.selectedTargetId];
    }
  }
  return legalTargets.length === 0 ? [] : [legalTargets[0]!];
}

function sourceHasKeyword(
  ctx: ResolutionContext,
  source: EffectSource,
  keyword: "LIFESTEAL" | "POISONOUS",
): boolean {
  const liveSource = getSourceUnit(ctx, source);
  if (liveSource !== undefined) {
    return liveSource.unit.keywords.includes(keyword);
  }
  return ctx.cardDefinitions.get(source.cardId)?.keywords.includes(keyword) ?? false;
}

function healHero(ctx: ResolutionContext, side: MatchSide, amount: number): void {
  const player = ctx.state.players[side];
  player.heroHealth = Math.min(
    RULES_CONFIG.heroHealth,
    player.heroHealth + Math.max(0, amount),
  );
}

function applyLifesteal(
  ctx: ResolutionContext,
  source: EffectSource,
  actualDamage: number,
): void {
  if (actualDamage > 0 && sourceHasKeyword(ctx, source, "LIFESTEAL")) {
    healHero(ctx, source.side, actualDamage);
  }
}

export function dealDamage(
  ctx: ResolutionContext,
  source: EffectSource,
  targetId: string,
  amount: number,
): DamageResult {
  const attemptedDamage = Math.max(0, amount);
  const heroSide = heroSideFromTarget(targetId);
  if (heroSide !== null) {
    const hero = ctx.state.players[heroSide];
    const actualDamage = Math.min(hero.heroHealth, attemptedDamage);
    hero.heroHealth -= actualDamage;
    applyLifesteal(ctx, source, actualDamage);
    if (hero.heroHealth === 0) {
      ctx.state.winner = heroSide === "A" ? "B" : "A";
    }
    if (actualDamage > 0) {
      enqueueTriggers(ctx, {
        type: "AFTER_DAMAGE",
        source,
        targetId,
        amount: actualDamage,
      });
    }
    return { actualDamage, preventedDamage: 0 };
  }

  const located = findUnit(ctx.state, targetId);
  if (located === undefined) {
    throw new RangeError(`Damage target ${targetId} does not exist.`);
  }
  if (located.unit.keywords.includes("DIVINE_SHIELD") && attemptedDamage > 0) {
    located.unit.keywords = located.unit.keywords.filter(
      (keyword) => keyword !== "DIVINE_SHIELD",
    );
    return { actualDamage: 0, preventedDamage: attemptedDamage };
  }

  const actualDamage = Math.min(located.unit.health, attemptedDamage);
  located.unit.health = Math.max(0, located.unit.health - attemptedDamage);
  if (
    actualDamage > 0 &&
    sourceHasKeyword(ctx, source, "POISONOUS")
  ) {
    located.unit.health = 0;
  }
  applyLifesteal(ctx, source, actualDamage);
  if (actualDamage > 0) {
    enqueueTriggers(ctx, {
      type: "AFTER_DAMAGE",
      source,
      targetId,
      amount: actualDamage,
    });
  }
  return { actualDamage, preventedDamage: 0 };
}

function createCardInstance(
  ctx: ResolutionContext,
  cardId: CardId,
): CardInstance {
  const sequence = ctx.state.nextInstanceSequence++;
  return {
    instanceId: `${ctx.state.matchId}:card:${sequence}`,
    cardId,
  };
}

function addCardToHand(
  ctx: ResolutionContext,
  side: MatchSide,
  card: CardInstance,
): void {
  const player = ctx.state.players[side];
  if (player.hand.length >= RULES_CONFIG.handLimit) {
    player.discard.push(card);
  } else {
    player.hand.push(card);
  }
}

function summon(ctx: ResolutionContext, cardId: CardId, amount: number): void {
  const definition = ctx.cardDefinitions.get(cardId);
  if (definition === undefined || definition.type !== "UNIT") {
    throw new RangeError(`Cannot summon missing or non-Unit card ${cardId}.`);
  }
  const board = ctx.state.players[ctx.source.side].board;
  const summonCount = Math.max(0, Math.trunc(amount));

  for (let index = 0; index < summonCount; index += 1) {
    if (board.length >= RULES_CONFIG.boardLimit) {
      break;
    }
    if (ctx.summonsThisChain >= RULES_CONFIG.maxSummonsPerChain) {
      appendInfiniteComboWarning(ctx, "SUMMONS");
      break;
    }
    const card = createCardInstance(ctx, cardId);
    const unit: UnitInstance = {
      ...card,
      attack: definition.attack,
      health: definition.health,
      maxHealth: definition.health,
      keywords: [...definition.keywords],
      summonedTurn: ctx.state.turnNumber,
      attacksThisTurn: 0,
      lastAttackTurn: ctx.state.turnNumber,
    };
    board.push(unit);
    ctx.summonsThisChain += 1;
  }
}

function discardCards(
  ctx: ResolutionContext,
  side: MatchSide,
  amount: number,
): void {
  const player = ctx.state.players[side];
  for (let index = 0; index < Math.max(0, Math.trunc(amount)); index += 1) {
    if (player.hand.length === 0) {
      break;
    }
    const rng = new DeterministicRng(
      deriveSeed([
        "discard",
        ctx.state.matchSeed.toString(),
        ctx.source.instanceId,
        ctx.actionCount,
        index,
      ]),
    );
    const [discarded] = player.hand.splice(rng.nextInt(player.hand.length), 1);
    player.discard.push(discarded!);
  }
}

function changeUnitStats(
  unit: UnitInstance,
  effect: Extract<
    CardEffect,
    {
      type:
        | "BUFF_ATTACK"
        | "BUFF_HEALTH"
        | "BUFF_STATS"
        | "DEBUFF_ATTACK"
        | "DEBUFF_HEALTH";
    }
  >,
): void {
  const amount = Math.max(0, effect.amount);
  switch (effect.type) {
    case "BUFF_ATTACK":
      unit.attack += amount;
      break;
    case "BUFF_HEALTH":
      unit.health += amount;
      unit.maxHealth += amount;
      break;
    case "BUFF_STATS":
      unit.attack += amount;
      unit.health += amount;
      unit.maxHealth += amount;
      break;
    case "DEBUFF_ATTACK":
      unit.attack = Math.max(0, unit.attack - amount);
      break;
    case "DEBUFF_HEALTH":
      unit.health = Math.max(0, unit.health - amount);
      unit.maxHealth = Math.max(0, unit.maxHealth - amount);
      break;
  }
}

export function resolveEffect(ctx: ResolutionContext, effect: CardEffect): void {
  if (!beginEffect(ctx)) {
    return;
  }

  switch (effect.type) {
    case "DEAL_DAMAGE":
      for (const targetId of effectTargets(ctx, effect.target)) {
        dealDamage(ctx, ctx.source, targetId, effect.amount);
      }
      checkStateBasedDeaths(ctx);
      break;
    case "HEAL":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const heroSide = heroSideFromTarget(targetId);
        if (heroSide !== null) {
          healHero(ctx, heroSide, effect.amount);
        } else {
          const unit = findUnit(ctx.state, targetId)?.unit;
          if (unit !== undefined) {
            unit.health = Math.min(unit.maxHealth, unit.health + Math.max(0, effect.amount));
          }
        }
      }
      break;
    case "DRAW":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const side = heroSideFromTarget(targetId);
        if (side !== null) {
          for (let index = 0; index < Math.max(0, Math.trunc(effect.amount)); index += 1) {
            drawCard(ctx.state, side);
          }
        }
      }
      break;
    case "DISCARD":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const side = heroSideFromTarget(targetId);
        if (side !== null) {
          discardCards(ctx, side, effect.amount);
        }
      }
      break;
    case "SUMMON":
      summon(ctx, effect.tokenCardId, effect.amount);
      break;
    case "DESTROY":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const unit = findUnit(ctx.state, targetId)?.unit;
        if (unit !== undefined) {
          unit.health = 0;
        }
      }
      checkStateBasedDeaths(ctx);
      break;
    case "BUFF_ATTACK":
    case "BUFF_HEALTH":
    case "BUFF_STATS":
    case "DEBUFF_ATTACK":
    case "DEBUFF_HEALTH":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const unit = findUnit(ctx.state, targetId)?.unit;
        if (unit !== undefined) {
          changeUnitStats(unit, effect);
        }
      }
      checkStateBasedDeaths(ctx);
      break;
    case "GAIN_KEYWORD":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const unit = findUnit(ctx.state, targetId)?.unit;
        if (unit !== undefined && !unit.keywords.includes(effect.keyword)) {
          unit.keywords.push(effect.keyword);
        }
      }
      break;
    case "REMOVE_KEYWORD":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const unit = findUnit(ctx.state, targetId)?.unit;
        if (unit !== undefined) {
          unit.keywords = unit.keywords.filter(
            (keyword) => keyword !== effect.keyword,
          );
        }
      }
      break;
    case "CREATE_CARD":
      for (let index = 0; index < Math.max(0, Math.trunc(effect.amount)); index += 1) {
        addCardToHand(
          ctx,
          ctx.source.side,
          createCardInstance(ctx, effect.cardId),
        );
      }
      break;
    case "COPY_CARD":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const target = findUnit(ctx.state, targetId)?.unit;
        if (target !== undefined) {
          addCardToHand(
            ctx,
            ctx.source.side,
            createCardInstance(ctx, target.cardId),
          );
        }
      }
      break;
    case "RETURN_TO_HAND":
      for (const targetId of effectTargets(ctx, effect.target)) {
        const located = findUnit(ctx.state, targetId);
        if (located !== undefined) {
          const board = ctx.state.players[located.side].board;
          board.splice(board.indexOf(located.unit), 1);
          addCardToHand(ctx, located.side, {
            instanceId: located.unit.instanceId,
            cardId: located.unit.cardId,
          });
        }
      }
      break;
    case "GAIN_MANA_THIS_TURN":
      ctx.state.players[ctx.source.side].mana += Math.max(0, effect.amount);
      break;
    case "GAIN_MAX_MANA": {
      const player = ctx.state.players[ctx.source.side];
      player.maxMana = Math.min(
        RULES_CONFIG.maxMana,
        player.maxMana + Math.max(0, effect.amount),
      );
      break;
    }
  }
}
