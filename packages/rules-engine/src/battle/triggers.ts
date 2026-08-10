import { RULES_CONFIG } from "@tcgtycoon/balance";
import type {
  CardDefinition,
  CardId,
  CardTrigger,
  TriggerType,
} from "@tcgtycoon/domain";
import { resolveEffect } from "./effects";
import { checkStateBasedDeaths } from "./state-check";
import { findUnit, type EffectSource, type LocatedUnit } from "./targeting";
import type { MatchSide, MatchState } from "./types";

export type MatchWarning = {
  code: "POTENTIAL_INFINITE_COMBO";
  message: string;
  limit: "ACTIONS" | "TRIGGER_DEPTH" | "SUMMONS";
};

export type PendingTrigger = {
  source: EffectSource;
  trigger: CardTrigger;
  depth: number;
};

export type MatchEvent =
  | {
      type: "ON_PLAY";
      source: EffectSource;
      playedFromHand: boolean;
    }
  | {
      type: "ON_DEATH" | "AFTER_ATTACK" | "AFTER_DAMAGE";
      source: EffectSource;
      targetId?: string;
      amount?: number;
    }
  | { type: "TURN_START" | "TURN_END"; side: MatchSide }
  | { type: "AFTER_SPELL_PLAYED"; source: EffectSource }
  | { type: "UNIT_DIED"; source: EffectSource };

export type ResolutionContext = {
  state: MatchState;
  cardDefinitions: ReadonlyMap<CardId, CardDefinition>;
  queue: PendingTrigger[];
  actionCount: number;
  triggerDepth: number;
  summonsThisChain: number;
  warnings: MatchWarning[];
  source: EffectSource;
  selectedTargetId?: string;
};

export function appendInfiniteComboWarning(
  ctx: ResolutionContext,
  limit: MatchWarning["limit"],
): void {
  if (
    !ctx.warnings.some(
      (warning) =>
        warning.code === "POTENTIAL_INFINITE_COMBO" && warning.limit === limit,
    )
  ) {
    ctx.warnings.push({
      code: "POTENTIAL_INFINITE_COMBO",
      message: `Resolution stopped after crossing the ${limit.toLowerCase()} safety limit.`,
      limit,
    });
  }
  ctx.queue.length = 0;
}

function definitionFor(
  ctx: ResolutionContext,
  source: EffectSource,
): CardDefinition | undefined {
  return ctx.cardDefinitions.get(source.cardId);
}

function boardSources(ctx: ResolutionContext): EffectSource[] {
  return (["A", "B"] as const).flatMap((side) =>
    ctx.state.players[side].board.map((unit) => ({
      side,
      instanceId: unit.instanceId,
      cardId: unit.cardId,
    })),
  );
}

function triggerCandidates(
  ctx: ResolutionContext,
  event: MatchEvent,
): { source: EffectSource; triggerType: TriggerType }[] {
  switch (event.type) {
    case "ON_PLAY":
      return event.playedFromHand
        ? [{ source: event.source, triggerType: "ON_PLAY" }]
        : [];
    case "ON_DEATH":
    case "AFTER_ATTACK":
    case "AFTER_DAMAGE":
      return [{ source: event.source, triggerType: event.type }];
    case "TURN_START":
    case "TURN_END":
      return boardSources(ctx).map((source) => ({
        source,
        triggerType: event.type,
      }));
    case "AFTER_SPELL_PLAYED":
      return boardSources(ctx).map((source) => ({
        source,
        triggerType: "AFTER_SPELL_PLAYED",
      }));
    case "UNIT_DIED":
      return boardSources(ctx).map((source) => ({
        source,
        triggerType:
          source.side === event.source.side
            ? "AFTER_FRIENDLY_UNIT_DIES"
            : "AFTER_ENEMY_UNIT_DIES",
      }));
  }
}

export function enqueueTriggers(
  ctx: ResolutionContext,
  event: MatchEvent,
): void {
  for (const candidate of triggerCandidates(ctx, event)) {
    const definition = definitionFor(ctx, candidate.source);
    if (definition === undefined) {
      continue;
    }
    for (const trigger of definition.triggers) {
      if (trigger.trigger === candidate.triggerType) {
        ctx.queue.push({
          source: candidate.source,
          trigger,
          depth: ctx.triggerDepth + 1,
        });
      }
    }
  }
}

export function resolveTriggerQueue(ctx: ResolutionContext): void {
  while (ctx.queue.length > 0) {
    const pending = ctx.queue.shift()!;
    if (pending.depth > RULES_CONFIG.maxTriggerDepth) {
      appendInfiniteComboWarning(ctx, "TRIGGER_DEPTH");
      break;
    }

    ctx.triggerDepth = pending.depth;
    ctx.source = pending.source;
    delete ctx.selectedTargetId;

    for (const effect of pending.trigger.effects) {
      resolveEffect(ctx, effect);
      if (ctx.warnings.length > 0 && ctx.queue.length === 0) {
        break;
      }
      checkStateBasedDeaths(ctx);
    }
  }
  ctx.triggerDepth = 0;
}

export function getSourceUnit(
  ctx: ResolutionContext,
  source: EffectSource = ctx.source,
): LocatedUnit | undefined {
  return findUnit(ctx.state, source.instanceId);
}
