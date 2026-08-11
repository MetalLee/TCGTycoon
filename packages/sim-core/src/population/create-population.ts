import { POPULATION_CONFIG } from "@tcgtycoon/balance";
import {
  agentId,
  playerId,
  type NamedAgent,
  type PersistentPlayer,
  type PopulationCohort,
} from "@tcgtycoon/domain";
import { deriveSeed, DeterministicRng } from "@tcgtycoon/rules-engine";
import { createEmptyKnowledgeState } from "../society/knowledge";

export type InitialPopulation = {
  players: Record<string, PersistentPlayer>;
  agents: Record<string, NamedAgent>;
  cohorts: PopulationCohort[];
};

function stableId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, "0")}`;
}

function createPlayer(seed: string, index: number): PersistentPlayer {
  const rng = new DeterministicRng(
    deriveSeed([seed, "persistent-player", index]),
  );
  const walletRange =
    POPULATION_CONFIG.initialWallet.maximumExclusive -
    POPULATION_CONFIG.initialWallet.minimum;

  return {
    id: playerId(stableId("player", index)),
    motivation: {
      competitive: rng.nextFloat(),
      brewer: rng.nextFloat(),
      casual: rng.nextFloat(),
      collector: rng.nextFloat(),
      budgetSensitivity: rng.nextFloat(),
      whale: rng.nextFloat(),
    },
    skill: rng.nextFloat(),
    loyalty: rng.nextFloat(),
    tenureDays: 0,
    tcgWallet:
      POPULATION_CONFIG.initialWallet.minimum + rng.nextInt(walletRange),
    activity: "NEW",
    collection: {},
    deckIds: [],
    knowledge: createEmptyKnowledgeState(),
    satisfaction: POPULATION_CONFIG.initialSatisfaction,
  };
}

function namedAgentRoles(): string[] {
  return POPULATION_CONFIG.namedAgentRoles.flatMap(({ role, count }) =>
    Array.from({ length: count }, () => role),
  );
}

function createAgent(
  seed: string,
  index: number,
  role: string,
  ownerId: PersistentPlayer["id"],
): NamedAgent {
  const rng = new DeterministicRng(deriveSeed([seed, "named-agent", index]));

  return {
    id: agentId(stableId("agent", index)),
    playerId: ownerId,
    name: `Agent ${String(index + 1).padStart(2, "0")}`,
    role,
    influence: rng.nextFloat(),
    followers: rng.nextInt(
      POPULATION_CONFIG.maximumNamedAgentFollowersExclusive,
    ),
    brandAttitude: rng.nextFloat() * 2 - 1,
    recentMemories: [],
    longTermSummary: "",
  };
}

export function createInitialPopulation(
  seed: string,
  count = POPULATION_CONFIG.standardPersistentPlayerCount,
): InitialPopulation {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("count must be a non-negative integer");
  }

  const players: Record<string, PersistentPlayer> = {};
  for (let index = 0; index < count; index += 1) {
    const player = createPlayer(seed, index);
    players[player.id] = player;
  }

  const agents: Record<string, NamedAgent> = {};
  const roles = namedAgentRoles();
  const agentCount = Math.min(
    count,
    POPULATION_CONFIG.standardNamedAgentCount,
    roles.length,
  );
  for (let index = 0; index < agentCount; index += 1) {
    const owner = players[stableId("player", index)];
    const role = roles[index];
    if (owner === undefined || role === undefined) {
      throw new Error("Named Agent generation lost its stable player or role");
    }

    const agent = createAgent(seed, index, role, owner.id);
    agents[agent.id] = agent;
  }

  return {
    players,
    agents,
    cohorts: [{ id: "cohort-new", count }],
  };
}
