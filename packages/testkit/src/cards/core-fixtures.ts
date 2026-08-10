import {
  cardId,
  factionId,
  type CardDefinition,
  type CardTrigger,
  type FactionId,
  type Keyword,
} from "@tcgtycoon/domain";

const fireFactionId = factionId("fire");
const machineFactionId = factionId("machine");
const neutralFactionId = factionId("neutral");

type UnitOptions = {
  keywords?: Keyword[];
  triggers?: CardTrigger[];
};

function unit(
  id: string,
  name: string,
  factionId: FactionId,
  cost: number,
  attack: number,
  health: number,
  options: UnitOptions = {},
): CardDefinition {
  return {
    id: cardId(id),
    name,
    type: "UNIT",
    factionId,
    rarity: "COMMON",
    cost,
    attack,
    health,
    keywords: options.keywords ?? [],
    triggers: options.triggers ?? [],
  };
}

function spell(
  id: string,
  name: string,
  factionId: FactionId,
  cost: number,
  effects: CardTrigger["effects"],
): CardDefinition {
  return {
    id: cardId(id),
    name,
    type: "SPELL",
    factionId,
    rarity: "COMMON",
    cost,
    keywords: [],
    triggers: [{ trigger: "ON_PLAY", conditions: [], effects }],
  };
}

export const coreCardFixtures: CardDefinition[] = [
  unit("card-fire-cub", "Fire Cub", fireFactionId, 1, 1, 2, {
    keywords: ["TAUNT"],
  }),
  unit("card-fire-charger", "Fire Charger", fireFactionId, 2, 2, 1, {
    keywords: ["CHARGE"],
  }),
  unit("card-fire-runner", "Fire Runner", fireFactionId, 2, 3, 1, {
    keywords: ["RUSH"],
  }),
  unit("card-fire-herald", "Fire Herald", fireFactionId, 3, 2, 3, {
    keywords: ["BATTLECRY"],
    triggers: [
      {
        trigger: "ON_PLAY",
        conditions: [],
        effects: [{ type: "DEAL_DAMAGE", amount: 1, target: "ENEMY_HERO" }],
      },
    ],
  }),
  unit("card-fire-phoenix", "Fire Phoenix", fireFactionId, 4, 3, 3, {
    keywords: ["DEATHRATTLE"],
    triggers: [
      {
        trigger: "ON_DEATH",
        conditions: [],
        effects: [
          { type: "SUMMON", tokenCardId: cardId("card-fire-cub"), amount: 1 },
        ],
      },
    ],
  }),
  unit("card-fire-guardian", "Fire Guardian", fireFactionId, 3, 2, 4, {
    keywords: ["DIVINE_SHIELD"],
  }),
  unit("card-fire-drinker", "Fire Drinker", fireFactionId, 4, 4, 3, {
    keywords: ["LIFESTEAL"],
  }),
  unit("card-fire-twins", "Fire Twins", fireFactionId, 5, 3, 5, {
    keywords: ["WINDFURY"],
  }),
  unit("card-fire-stalker", "Fire Stalker", fireFactionId, 3, 3, 2, {
    keywords: ["STEALTH"],
  }),
  unit("card-fire-venom", "Fire Venom", fireFactionId, 4, 1, 5, {
    keywords: ["POISONOUS"],
  }),
  unit("card-machine-guard", "Machine Guard", machineFactionId, 2, 1, 4, {
    keywords: ["TAUNT"],
  }),
  unit("card-machine-rocket", "Machine Rocket", machineFactionId, 3, 3, 2, {
    keywords: ["CHARGE"],
  }),
  unit("card-machine-repairer", "Machine Repairer", machineFactionId, 3, 2, 3, {
    keywords: ["BATTLECRY"],
    triggers: [
      {
        trigger: "ON_PLAY",
        conditions: [],
        effects: [{ type: "HEAL", amount: 2, target: "FRIENDLY_HERO" }],
      },
    ],
  }),
  unit("card-machine-salvager", "Machine Salvager", machineFactionId, 3, 3, 2, {
    keywords: ["DEATHRATTLE"],
    triggers: [
      {
        trigger: "ON_DEATH",
        conditions: [],
        effects: [{ type: "DRAW", amount: 1, target: "FRIENDLY_HERO" }],
      },
    ],
  }),
  unit("card-machine-buffer", "Machine Buffer", machineFactionId, 4, 3, 4, {
    triggers: [
      {
        trigger: "ON_PLAY",
        conditions: [],
        effects: [{ type: "BUFF_ATTACK", amount: 1, target: "FRIENDLY_UNIT" }],
      },
    ],
  }),
  unit(
    "card-machine-disruptor",
    "Machine Disruptor",
    machineFactionId,
    4,
    4,
    3,
    {
      triggers: [
        {
          trigger: "ON_PLAY",
          conditions: [],
          effects: [{ type: "DEBUFF_ATTACK", amount: 1, target: "ENEMY_UNIT" }],
        },
      ],
    },
  ),
  spell("card-machine-bolt", "Machine Bolt", machineFactionId, 2, [
    { type: "DEAL_DAMAGE", amount: 2, target: "ENEMY_UNIT" },
  ]),
  spell("card-machine-recall", "Machine Recall", machineFactionId, 2, [
    { type: "RETURN_TO_HAND", target: "FRIENDLY_UNIT" },
  ]),
  spell("card-machine-fabricate", "Machine Fabricate", machineFactionId, 3, [
    { type: "CREATE_CARD", cardId: cardId("card-neutral-scout"), amount: 1 },
  ]),
  spell("card-machine-overclock", "Machine Overclock", machineFactionId, 1, [
    { type: "GAIN_MANA_THIS_TURN", amount: 1 },
  ]),
  unit("card-neutral-scout", "Neutral Scout", neutralFactionId, 1, 1, 1),
  spell("card-neutral-medicine", "Neutral Medicine", neutralFactionId, 2, [
    { type: "HEAL", amount: 3, target: "FRIENDLY_HERO" },
  ]),
  spell("card-neutral-insight", "Neutral Insight", neutralFactionId, 2, [
    { type: "DRAW", amount: 1, target: "FRIENDLY_HERO" },
  ]),
  unit("card-neutral-banner", "Neutral Banner", neutralFactionId, 3, 2, 3, {
    triggers: [
      {
        trigger: "ON_PLAY",
        conditions: [],
        effects: [{ type: "BUFF_STATS", amount: 1, target: "FRIENDLY_UNIT" }],
      },
    ],
  }),
];
