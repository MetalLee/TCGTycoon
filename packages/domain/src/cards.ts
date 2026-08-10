import { z } from "zod";
import { cardId, factionId, type CardId, type FactionId } from "./ids";
import { KEYWORDS, type CardType, type Keyword, type Rarity } from "./rules";

export const targetSelectors = [
  "SELF",
  "FRIENDLY_UNIT",
  "ENEMY_UNIT",
  "ANY_UNIT",
  "FRIENDLY_HERO",
  "ENEMY_HERO",
  "ANY_CHARACTER",
  "RANDOM_FRIENDLY_UNIT",
  "RANDOM_ENEMY_UNIT",
  "ALL_FRIENDLY_UNITS",
  "ALL_ENEMY_UNITS",
] as const;

export type TargetSelector = (typeof targetSelectors)[number];

type NumericTargetEffect = {
  amount: number;
  target: TargetSelector;
};

export type CardEffect =
  | ({ type: "DEAL_DAMAGE" } & NumericTargetEffect)
  | ({ type: "HEAL" } & NumericTargetEffect)
  | ({ type: "DRAW" } & NumericTargetEffect)
  | ({ type: "DISCARD" } & NumericTargetEffect)
  | { type: "SUMMON"; tokenCardId: CardId; amount: number }
  | { type: "DESTROY"; target: TargetSelector }
  | ({ type: "BUFF_ATTACK" } & NumericTargetEffect)
  | ({ type: "BUFF_HEALTH" } & NumericTargetEffect)
  | ({ type: "BUFF_STATS" } & NumericTargetEffect)
  | ({ type: "DEBUFF_ATTACK" } & NumericTargetEffect)
  | ({ type: "DEBUFF_HEALTH" } & NumericTargetEffect)
  | { type: "GAIN_KEYWORD"; keyword: Keyword; target: TargetSelector }
  | { type: "REMOVE_KEYWORD"; keyword: Keyword; target: TargetSelector }
  | { type: "CREATE_CARD"; cardId: CardId; amount: number }
  | { type: "COPY_CARD"; target: TargetSelector; destination: "HAND" }
  | { type: "RETURN_TO_HAND"; target: TargetSelector }
  | { type: "GAIN_MANA_THIS_TURN"; amount: number }
  | { type: "GAIN_MAX_MANA"; amount: number };

export const triggerTypes = [
  "ON_PLAY",
  "ON_DEATH",
  "TURN_START",
  "TURN_END",
  "AFTER_ATTACK",
  "AFTER_DAMAGE",
  "AFTER_FRIENDLY_UNIT_DIES",
  "AFTER_ENEMY_UNIT_DIES",
  "AFTER_SPELL_PLAYED",
] as const;

export type TriggerType = (typeof triggerTypes)[number];

// No condition discriminators are approved by the MVP specification yet.
// Keeping the union empty prevents unapproved executable semantics from entering
// the DSL while preserving the CardTrigger interface for a future spec revision.
export type Condition = never;

export type CardTrigger = {
  trigger: TriggerType;
  conditions: Condition[];
  effects: CardEffect[];
};

type CardDefinitionBase = {
  id: CardId;
  name: string;
  type: CardType;
  factionId: FactionId;
  rarity: Rarity;
  cost: number;
  keywords: Keyword[];
  triggers: CardTrigger[];
};

export type CardDefinition =
  | (CardDefinitionBase & {
      type: "UNIT";
      attack: number;
      health: number;
    })
  | (CardDefinitionBase & {
      type: "SPELL";
      attack?: never;
      health?: never;
    });

const targetSelectorSchema = z.enum(targetSelectors);
const keywordSchema = z.enum(KEYWORDS);
const cardIdSchema = z.string().transform(cardId);
const factionIdSchema = z.string().transform(factionId);

const numericTargetEffectSchema = <T extends string>(type: T) =>
  z
    .object({
      type: z.literal(type),
      amount: z.number(),
      target: targetSelectorSchema,
    })
    .strict();

const cardEffectSchema = z.discriminatedUnion("type", [
  numericTargetEffectSchema("DEAL_DAMAGE"),
  numericTargetEffectSchema("HEAL"),
  numericTargetEffectSchema("DRAW"),
  numericTargetEffectSchema("DISCARD"),
  z
    .object({
      type: z.literal("SUMMON"),
      tokenCardId: cardIdSchema,
      amount: z.number(),
    })
    .strict(),
  z
    .object({
      type: z.literal("DESTROY"),
      target: targetSelectorSchema,
    })
    .strict(),
  numericTargetEffectSchema("BUFF_ATTACK"),
  numericTargetEffectSchema("BUFF_HEALTH"),
  numericTargetEffectSchema("BUFF_STATS"),
  numericTargetEffectSchema("DEBUFF_ATTACK"),
  numericTargetEffectSchema("DEBUFF_HEALTH"),
  z
    .object({
      type: z.literal("GAIN_KEYWORD"),
      keyword: keywordSchema,
      target: targetSelectorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("REMOVE_KEYWORD"),
      keyword: keywordSchema,
      target: targetSelectorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("CREATE_CARD"),
      cardId: cardIdSchema,
      amount: z.number(),
    })
    .strict(),
  z
    .object({
      type: z.literal("COPY_CARD"),
      target: targetSelectorSchema,
      destination: z.literal("HAND"),
    })
    .strict(),
  z
    .object({
      type: z.literal("RETURN_TO_HAND"),
      target: targetSelectorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("GAIN_MANA_THIS_TURN"),
      amount: z.number(),
    })
    .strict(),
  z
    .object({
      type: z.literal("GAIN_MAX_MANA"),
      amount: z.number(),
    })
    .strict(),
]);

const conditionSchema: z.ZodType<Condition> = z.never();

const cardTriggerSchema = z
  .object({
    trigger: z.enum(triggerTypes),
    conditions: z.array(conditionSchema),
    effects: z.array(cardEffectSchema).max(3),
  })
  .strict();

const cardDefinitionBaseShape = {
  id: cardIdSchema,
  name: z.string(),
  factionId: factionIdSchema,
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "LEGENDARY"]),
  cost: z.number().int().min(0).max(8),
  keywords: z.array(keywordSchema),
  triggers: z.array(cardTriggerSchema).max(2),
};

export const cardDefinitionSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...cardDefinitionBaseShape,
      type: z.literal("UNIT"),
      attack: z.number().int().min(0),
      health: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      ...cardDefinitionBaseShape,
      type: z.literal("SPELL"),
    })
    .strict(),
]);

export function parseCardDefinition(input: unknown): CardDefinition {
  return cardDefinitionSchema.parse(input) as CardDefinition;
}
