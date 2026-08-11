import { RULES_CONFIG } from "@tcgtycoon/balance";
import type {
  CardDefinition,
  CardEffect,
  CardId,
  TargetSelector,
} from "@tcgtycoon/domain";
import { COIN_CARD_ID } from "../battle/create-match-state";
import {
  findUnit,
  heroSideFromTarget,
  heroTargetId,
  opposingSide,
} from "../battle/targeting";
import type {
  BattleAction,
  CardInstance,
  MatchSide,
  MatchState,
  UnitInstance,
} from "../battle/types";
import { DeterministicRng, deriveSeed } from "../rng/deterministic-rng";

export type BattleStrategy = {
  aggression: number;
  value: number;
  preservation: number;
};

type ChooseBattleActionInput = {
  state: MatchState;
  cards: ReadonlyMap<CardId, CardDefinition>;
  strategy: BattleStrategy;
  decisionSequence: number;
};

const selectorsWithoutChosenTarget = new Set<TargetSelector>([
  "RANDOM_FRIENDLY_UNIT",
  "RANDOM_ENEMY_UNIT",
  "ALL_FRIENDLY_UNITS",
  "ALL_ENEMY_UNITS",
]);

function targetIdsForSelector(
  state: MatchState,
  side: MatchSide,
  selector: TargetSelector,
  prospectiveUnitId?: string,
): string[] {
  const enemySide = opposingSide(side);
  const friendlyUnitIds = state.players[side].board.map(
    (unit) => unit.instanceId,
  );
  if (prospectiveUnitId !== undefined) {
    friendlyUnitIds.push(prospectiveUnitId);
  }
  const enemyUnitIds = state.players[enemySide].board
    .filter((unit) => !unit.keywords.includes("STEALTH"))
    .map((unit) => unit.instanceId);

  switch (selector) {
    case "SELF":
      return prospectiveUnitId === undefined ? [] : [prospectiveUnitId];
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
      return [heroTargetId(side)];
    case "ENEMY_HERO":
      return [heroTargetId(enemySide)];
    case "ANY_CHARACTER":
      return [
        ...friendlyUnitIds,
        ...enemyUnitIds,
        heroTargetId(side),
        heroTargetId(enemySide),
      ];
  }
}

function effectSelector(effect: CardEffect): TargetSelector | undefined {
  return "target" in effect ? effect.target : undefined;
}

function legalPlayTargets(
  state: MatchState,
  side: MatchSide,
  card: CardInstance,
  definition: CardDefinition,
): (string | undefined)[] {
  const prospectiveUnitId =
    definition.type === "UNIT" ? card.instanceId : undefined;
  const targetSets = definition.triggers
    .filter((trigger) => trigger.trigger === "ON_PLAY")
    .flatMap((trigger) => trigger.effects)
    .map(effectSelector)
    .filter(
      (selector): selector is TargetSelector =>
        selector !== undefined && !selectorsWithoutChosenTarget.has(selector),
    )
    .map((selector) =>
      targetIdsForSelector(state, side, selector, prospectiveUnitId),
    );

  if (targetSets.length === 0) {
    return [undefined];
  }

  const [firstTargets, ...remainingTargetSets] = targetSets;
  return firstTargets!.filter((targetId) =>
    remainingTargetSets.every((targets) => targets.includes(targetId)),
  );
}

function canAttack(unit: UnitInstance, state: MatchState): boolean {
  const attacksThisTurn =
    unit.lastAttackTurn === state.turnNumber ? unit.attacksThisTurn : 0;
  const attackLimit = unit.keywords.includes("WINDFURY") ? 2 : 1;
  if (attacksThisTurn >= attackLimit) {
    return false;
  }

  if (unit.summonedTurn !== state.turnNumber) {
    return true;
  }
  return unit.keywords.includes("CHARGE") || unit.keywords.includes("RUSH");
}

function legalAttackTargets(
  state: MatchState,
  side: MatchSide,
  attacker: UnitInstance,
): string[] {
  const enemySide = opposingSide(side);
  const visibleEnemies = state.players[enemySide].board.filter(
    (unit) => !unit.keywords.includes("STEALTH"),
  );
  const taunts = visibleEnemies.filter((unit) =>
    unit.keywords.includes("TAUNT"),
  );
  if (taunts.length > 0) {
    return taunts.map((unit) => unit.instanceId);
  }

  const unitTargets = visibleEnemies.map((unit) => unit.instanceId);
  return attacker.summonedTurn === state.turnNumber &&
    attacker.keywords.includes("RUSH") &&
    !attacker.keywords.includes("CHARGE")
    ? unitTargets
    : [...unitTargets, heroTargetId(enemySide)];
}

export function enumerateLegalActions(
  state: MatchState,
  cards: ReadonlyMap<CardId, CardDefinition>,
): BattleAction[] {
  const side = state.activeSide;
  const player = state.players[side];
  const actions: BattleAction[] = [];

  for (const card of player.hand) {
    if (card.cardId === COIN_CARD_ID) {
      actions.push({
        type: "PLAY_CARD",
        side,
        cardInstanceId: card.instanceId,
      });
      continue;
    }

    const definition = cards.get(card.cardId);
    if (
      definition === undefined ||
      definition.cost > player.mana ||
      (definition.type === "UNIT" &&
        player.board.length >= RULES_CONFIG.boardLimit)
    ) {
      continue;
    }

    for (const targetId of legalPlayTargets(state, side, card, definition)) {
      actions.push({
        type: "PLAY_CARD",
        side,
        cardInstanceId: card.instanceId,
        ...(targetId === undefined ? {} : { targetId }),
      });
    }
  }

  for (const attacker of player.board) {
    if (!canAttack(attacker, state)) {
      continue;
    }
    for (const targetId of legalAttackTargets(state, side, attacker)) {
      actions.push({
        type: "ATTACK",
        side,
        attackerId: attacker.instanceId,
        targetId,
      });
    }
  }

  actions.push({ type: "END_TURN", side });
  return actions;
}

export function chooseMulliganCards(
  state: MatchState,
  side: MatchSide,
  cards: ReadonlyMap<CardId, CardDefinition>,
  strategy: BattleStrategy,
): string[] {
  const maximumKeptCost = Math.max(
    1,
    Math.min(4, 3 + Math.round(strategy.value - strategy.aggression)),
  );
  return state.players[side].hand
    .filter((card) => {
      if (card.cardId === COIN_CARD_ID) {
        return false;
      }
      return (cards.get(card.cardId)?.cost ?? 0) > maximumKeptCost;
    })
    .map((card) => card.instanceId);
}

function actionKey(action: BattleAction): string {
  switch (action.type) {
    case "PLAY_CARD":
      return `0:${action.cardInstanceId}:${action.targetId ?? ""}`;
    case "ATTACK":
      return `1:${action.attackerId}:${action.targetId}`;
    case "END_TURN":
      return "2";
  }
}

function scoreAttack(
  action: Extract<BattleAction, { type: "ATTACK" }>,
  state: MatchState,
  strategy: BattleStrategy,
): number {
  const attacker = findUnit(state, action.attackerId)!.unit;
  const targetHeroSide = heroSideFromTarget(action.targetId);
  if (targetHeroSide !== null) {
    if (attacker.attack >= state.players[targetHeroSide].heroHealth) {
      return 1_000_000;
    }
    return 100 + attacker.attack * (4 + strategy.aggression * 8);
  }

  const defender = findUnit(state, action.targetId)!.unit;
  const damageToDefender = Math.min(attacker.attack, defender.health);
  const damageToAttacker = Math.min(defender.attack, attacker.health);
  const defenderValue = defender.attack + defender.maxHealth;
  const attackerValue = attacker.attack + attacker.maxHealth;
  const killValue = attacker.attack >= defender.health ? defenderValue : 0;
  const lossCost = defender.attack >= attacker.health ? attackerValue : 0;

  return (
    20 +
    strategy.value * (damageToDefender * 2 + killValue) -
    strategy.preservation * (damageToAttacker * 2 + lossCost)
  );
}

function targetBelongsToSide(
  state: MatchState,
  targetId: string,
  side: MatchSide,
): boolean {
  return (
    heroSideFromTarget(targetId) === side ||
    findUnit(state, targetId)?.side === side
  );
}

function scoreTargetedEffect(
  effect: CardEffect,
  targetId: string,
  state: MatchState,
  side: MatchSide,
  strategy: BattleStrategy,
  prospectiveFriendlyTargetId?: string,
): number {
  const friendlyTarget =
    targetId === prospectiveFriendlyTargetId ||
    targetBelongsToSide(state, targetId, side);
  const enemyHeroTarget = heroSideFromTarget(targetId) === opposingSide(side);
  const amount = "amount" in effect ? Math.max(0, effect.amount) : 1;

  switch (effect.type) {
    case "DEAL_DAMAGE":
      return friendlyTarget
        ? -amount * 10
        : amount * (enemyHeroTarget ? 4 + strategy.aggression * 6 : 4);
    case "DESTROY":
      return friendlyTarget ? -100 : 40;
    case "HEAL":
    case "BUFF_ATTACK":
    case "BUFF_HEALTH":
    case "BUFF_STATS":
    case "GAIN_KEYWORD":
      return friendlyTarget ? amount * (2 + strategy.value) : -amount * 4;
    case "DEBUFF_ATTACK":
    case "DEBUFF_HEALTH":
    case "REMOVE_KEYWORD":
    case "RETURN_TO_HAND":
    case "DISCARD":
      return friendlyTarget ? -amount * 3 : amount * (2 + strategy.value);
    case "DRAW":
    case "COPY_CARD":
      return friendlyTarget ? amount * (3 + strategy.value) : -amount * 3;
    case "SUMMON":
    case "CREATE_CARD":
    case "GAIN_MANA_THIS_TURN":
    case "GAIN_MAX_MANA":
      return 0;
  }
}

function scorePlay(
  action: Extract<BattleAction, { type: "PLAY_CARD" }>,
  state: MatchState,
  cards: ReadonlyMap<CardId, CardDefinition>,
  strategy: BattleStrategy,
): number {
  const card = state.players[action.side].hand.find(
    (candidate) => candidate.instanceId === action.cardInstanceId,
  )!;
  if (card.cardId === COIN_CARD_ID) {
    return 5 + strategy.aggression;
  }

  const definition = cards.get(card.cardId)!;
  let score = 10 + definition.cost * (2 + strategy.value);
  if (definition.type === "UNIT") {
    score +=
      definition.attack * (1 + strategy.aggression) +
      definition.health * (strategy.value + strategy.preservation);
  } else {
    score += 2 * strategy.value;
  }

  if (action.targetId !== undefined) {
    for (const trigger of definition.triggers) {
      if (trigger.trigger !== "ON_PLAY") {
        continue;
      }
      for (const effect of trigger.effects) {
        score += scoreTargetedEffect(
          effect,
          action.targetId,
          state,
          action.side,
          strategy,
          action.cardInstanceId,
        );
      }
    }
  }
  return score;
}

function scoreAction(
  action: BattleAction,
  state: MatchState,
  cards: ReadonlyMap<CardId, CardDefinition>,
  strategy: BattleStrategy,
): number {
  switch (action.type) {
    case "PLAY_CARD":
      return scorePlay(action, state, cards, strategy);
    case "ATTACK":
      return scoreAttack(action, state, strategy);
    case "END_TURN":
      return 0;
  }
}

export function chooseBattleAction({
  state,
  cards,
  strategy,
  decisionSequence,
}: ChooseBattleActionInput): BattleAction {
  const actions = enumerateLegalActions(state, cards);
  const scored = actions.map((action) => ({
    action,
    score: scoreAction(action, state, cards, strategy),
  }));
  const bestScore = Math.max(...scored.map((candidate) => candidate.score));
  const tied = scored
    .filter((candidate) => candidate.score === bestScore)
    .sort((left, right) => {
      const leftKey = actionKey(left.action);
      const rightKey = actionKey(right.action);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });

  if (tied.length === 1) {
    return tied[0]!.action;
  }

  const rng = new DeterministicRng(
    deriveSeed([
      "battle-ai-tie",
      state.matchSeed.toString(),
      state.turnNumber,
      state.activeSide,
      decisionSequence,
    ]),
  );
  return tied[rng.nextInt(tied.length)]!.action;
}
