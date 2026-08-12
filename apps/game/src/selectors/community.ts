import type {
  AgentId,
  NamedAgent,
  WorldEvent,
  WorldState,
} from "../../../../packages/domain/src/index";

export type CommunityPostCategory =
  "TRENDING" | "COMPETITIVE" | "COLLECTORS" | "OFFICIAL";

export type CommunityEntityLink = Readonly<{
  kind: "CARD" | "DECK" | "AGENT" | "TOURNAMENT" | "PRODUCT" | "PRINTING";
  id: string;
  label: string;
  href: string;
}>;

export type CommunityPostIntent = Readonly<{
  id: string;
  day: number;
  category: CommunityPostCategory;
  sourceAgentId?: AgentId;
  templateText: string;
  links: readonly CommunityEntityLink[];
}>;

export type AgentProfileView = Readonly<{
  agent: NamedAgent;
  currentDeckId: string | null;
  currentDeckName: string | null;
  posts: readonly CommunityPostIntent[];
}>;

function safeRecord(reason: string | undefined): Record<string, unknown> {
  if (reason === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(reason);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function entityLink(
  world: WorldState,
  kind: CommunityEntityLink["kind"],
  id: string,
): CommunityEntityLink {
  switch (kind) {
    case "CARD":
      return {
        kind,
        id,
        label: world.cards[id]?.name ?? id,
        href: `/cards/${id}`,
      };
    case "DECK":
      return { kind, id, label: `Deck ${id}`, href: `/meta/decks/${id}` };
    case "AGENT":
      return {
        kind,
        id,
        label: world.agents[id]?.name ?? id,
        href: `/agents/${id}`,
      };
    case "TOURNAMENT":
      return {
        kind,
        id,
        label: `Tournament ${id}`,
        href: `/tournaments/${id}`,
      };
    case "PRODUCT":
      return {
        kind,
        id,
        label: world.products[id]?.name ?? id,
        href: `/products/${id}`,
      };
    case "PRINTING":
      return { kind, id, label: `Printing ${id}`, href: `/printings/${id}` };
  }
}

function intentFromEvent(
  world: WorldState,
  event: WorldEvent,
): CommunityPostIntent | null {
  const data = safeRecord(event.context?.reason);
  if (event.type === "TOURNAMENT_COMPLETED") {
    const tournamentId = text(data.tournamentId);
    const name = text(data.name) ?? "An official tournament";
    const winner = data.winner as Record<string, unknown> | undefined;
    const deckId = text(winner?.deckId);
    const links = [
      ...(tournamentId ? [entityLink(world, "TOURNAMENT", tournamentId)] : []),
      ...(deckId ? [entityLink(world, "DECK", deckId)] : []),
    ];
    return {
      id: event.id,
      day: event.day,
      category: "COMPETITIVE",
      templateText: `${name} concluded. The winning deck is now part of the public competitive record.`,
      links,
    };
  }
  if (event.type.startsWith("MILESTONE_CARD_PRICE_")) {
    const cardId = text(data.cardId);
    const printingId = text(data.printingId);
    const price = typeof data.price === "number" ? data.price : undefined;
    return {
      id: event.id,
      day: event.day,
      category: "COLLECTORS",
      templateText: `A card printing crossed ${price === undefined ? "a notable" : `$${price.toFixed(2)}`} market price milestone.`,
      links: [
        ...(cardId ? [entityLink(world, "CARD", cardId)] : []),
        ...(printingId ? [entityLink(world, "PRINTING", printingId)] : []),
      ],
    };
  }
  if (event.type === "OFFICIAL_ANNOUNCEMENT") {
    const [, subjectId] = (event.context?.reason ?? "").split(":", 2);
    return {
      id: event.id,
      day: event.day,
      category: "OFFICIAL",
      templateText:
        "The publisher issued an official announcement tied to a structured commitment.",
      links:
        subjectId && world.products[subjectId]
          ? [entityLink(world, "PRODUCT", subjectId)]
          : [],
    };
  }
  if (
    event.type === "PRODUCT_RELEASED" &&
    event.context?.productId !== undefined
  ) {
    return {
      id: event.id,
      day: event.day,
      category: "TRENDING",
      templateText: `${world.products[event.context.productId]?.name ?? "A product"} is now live.`,
      links: [entityLink(world, "PRODUCT", event.context.productId)],
    };
  }
  return null;
}

export function selectCommunityPosts(world: WorldState): CommunityPostIntent[] {
  return world.history.events
    .flatMap((event) => {
      const intent = intentFromEvent(world, event);
      return intent === null ? [] : [intent];
    })
    .sort(
      (left, right) => right.day - left.day || (left.id < right.id ? -1 : 1),
    );
}

export function selectAgentProfile(
  world: WorldState,
  id: AgentId,
): AgentProfileView | null {
  const agent = world.agents[id];
  if (agent === undefined) return null;
  const player = world.players[agent.playerId];
  const currentDeckId = player?.deckIds[0] ?? null;
  return {
    agent,
    currentDeckId,
    currentDeckName: currentDeckId === null ? null : `Deck ${currentDeckId}`,
    posts: selectCommunityPosts(world).filter(
      (post) => post.sourceAgentId === id,
    ),
  };
}
