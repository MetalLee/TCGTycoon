export const RULE_VERSION = "1" as const;

export const KEYWORDS = [
  "TAUNT",
  "CHARGE",
  "RUSH",
  "BATTLECRY",
  "DEATHRATTLE",
  "DIVINE_SHIELD",
  "LIFESTEAL",
  "WINDFURY",
  "STEALTH",
  "POISONOUS",
] as const;

export type Keyword = (typeof KEYWORDS)[number];
export type CardType = "UNIT" | "SPELL";
export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";
