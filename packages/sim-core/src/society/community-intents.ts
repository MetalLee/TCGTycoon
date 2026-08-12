import type {
  AgentId,
  FactionId,
  NamedAgent,
  WorldEvent,
  WorldState,
} from "@tcgtycoon/domain";

export type CommunityPostCategory =
  "TRENDING" | "COMPETITIVE" | "COLLECTORS" | "OFFICIAL";

export type CommunityPostAuthor = Readonly<{
  id: AgentId;
  name: string;
  role: string;
  personalityTraits: readonly string[];
  favoriteFactionId?: FactionId;
  riskTolerance: number;
  brandAttitude: number;
  influence: number;
  longTermSummary?: string;
}>;

export type CommunityPostFact = Readonly<{
  kind: string;
  entityId?: string;
  statement: string;
}>;

export type CommunitySocialImpact = Readonly<{
  positiveAttention: number;
  negativeAttention: number;
  sentimentTarget: number;
}>;

export type CommunityPostIntent = Readonly<{
  id: string;
  day: number;
  category: CommunityPostCategory;
  author: CommunityPostAuthor;
  topic: string;
  stance: "CONCERNED" | "NEUTRAL" | "SUPPORTIVE";
  sentiment: number;
  facts: readonly CommunityPostFact[];
  recentMemories: readonly string[];
  influence: number;
  socialImpact: CommunitySocialImpact;
  templateText: string;
}>;

export type CreateCommunityPostIntentsInput = Readonly<{
  world: WorldState;
  day: number;
  events: readonly WorldEvent[];
  socialImpact: CommunitySocialImpact;
}>;

export function communityPostIntentId(
  worldSeed: string,
  eventId: string,
): string {
  return `community-intent:${worldSeed}:${eventId}`;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSentiment(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function categoryForEvent(event: WorldEvent): CommunityPostCategory {
  if (event.type === "TOURNAMENT_COMPLETED") return "COMPETITIVE";
  if (event.type.startsWith("MILESTONE_CARD_PRICE_")) return "COLLECTORS";
  if (event.type === "OFFICIAL_ANNOUNCEMENT") return "OFFICIAL";
  return "TRENDING";
}

function isCommunityFeedEvent(event: WorldEvent): boolean {
  return (
    event.type === "TOURNAMENT_COMPLETED" ||
    event.type.startsWith("MILESTONE_CARD_PRICE_") ||
    event.type === "OFFICIAL_ANNOUNCEMENT" ||
    event.type === "PRODUCT_RELEASED"
  );
}

function eventTopic(world: WorldState, event: WorldEvent): string {
  if (event.type === "OFFICIAL_ANNOUNCEMENT") {
    return "the publisher's official announcement";
  }
  if (event.type === "PRODUCT_RELEASED") {
    const productId = event.context?.productId;
    return productId === undefined
      ? "the latest product release"
      : `${world.products[productId]?.name ?? productId}'s release`;
  }
  if (event.type === "PRIMARY_PRODUCT_SALES") {
    return "today's primary product sales";
  }
  if (event.type === "SECONDARY_MARKET_TRADES") {
    return "today's secondary market activity";
  }
  if (event.type === "TOURNAMENT_COMPLETED") {
    return "the latest official tournament result";
  }
  if (event.type.startsWith("MILESTONE_CARD_PRICE_")) {
    return "a notable card price movement";
  }
  return event.type.toLowerCase().replaceAll("_", " ");
}

function stanceFor(agent: NamedAgent): CommunityPostIntent["stance"] {
  if (agent.brandAttitude < 0) return "CONCERNED";
  if (agent.brandAttitude > 0) return "SUPPORTIVE";
  return "NEUTRAL";
}

function stancePhrase(stance: CommunityPostIntent["stance"]): string {
  if (stance === "CONCERNED") return "expressed concern about";
  if (stance === "SUPPORTIVE") return "expressed support for";
  return "commented on";
}

function authorFor(world: WorldState, agent: NamedAgent): CommunityPostAuthor {
  const player = world.players[agent.playerId];
  const deck =
    player?.deckIds[0] === undefined
      ? undefined
      : world.decks[player.deckIds[0]];
  const summary = agent.longTermSummary.trim();
  return {
    id: agent.id,
    name: agent.name.slice(0, 120),
    role: agent.role.slice(0, 120),
    personalityTraits: [agent.role.toLowerCase().slice(0, 120)],
    ...(deck === undefined ? {} : { favoriteFactionId: deck.factionId }),
    riskTolerance: clampUnit(player?.motivation.brewer ?? 0.5),
    brandAttitude: clampSentiment(agent.brandAttitude),
    influence: clampUnit(agent.influence),
    ...(summary.length === 0
      ? {}
      : { longTermSummary: summary.slice(0, 2_000) }),
  };
}

function factsFor(
  world: WorldState,
  event: WorldEvent,
  day: number,
): CommunityPostFact[] {
  const productId = event.context?.productId;
  return [
    {
      kind: event.type.slice(0, 120),
      ...(productId === undefined ? {} : { entityId: productId }),
      statement: `The simulation recorded ${eventTopic(world, event)} on Day ${day}.`,
    },
    {
      kind: "META_HEALTH",
      statement: `Observed Meta Health is ${world.metrics.metaHealth.toFixed(1)}.`,
    },
    {
      kind: "ACTIVE_PLAYERS",
      statement: `The game has ${world.metrics.activePlayers} active players.`,
    },
  ];
}

export function createCommunityPostIntents(
  input: CreateCommunityPostIntentsInput,
): CommunityPostIntent[] {
  if (input.day < 1 || input.world.status !== "LIVE") return [];
  const agents = Object.values(input.world.agents).sort((left, right) =>
    compareIds(left.id, right.id),
  );
  if (agents.length === 0) return [];

  return input.events
    .filter(isCommunityFeedEvent)
    .slice(0, 8)
    .map((event, index) => {
      const agent = agents[(input.day - 1 + index) % agents.length]!;
      const author = authorFor(input.world, agent);
      const topic = eventTopic(input.world, event).slice(0, 500);
      const stance = stanceFor(agent);
      return {
        id: communityPostIntentId(input.world.worldSeed, event.id),
        day: input.day,
        category: categoryForEvent(event),
        author,
        topic,
        stance,
        sentiment: author.brandAttitude,
        facts: factsFor(input.world, event, input.day),
        recentMemories: agent.recentMemories
          .slice(-20)
          .map((memory) => memory.slice(0, 1_000)),
        influence: author.influence,
        socialImpact: { ...input.socialImpact },
        templateText: `${author.name} ${stancePhrase(stance)} ${topic}.`,
      };
    });
}
