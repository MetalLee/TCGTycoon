// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  printingId,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";
import { createTestWorld } from "../../../../../packages/testkit/src/index";
import { afterEach, describe, expect, it } from "vitest";
import { selectPolicyCardContext } from "../../selectors/meta";
import { PolicyDialog } from "./PolicyDialog";

afterEach(cleanup);

describe("PolicyDialog", () => {
  it("shows observed context and queues a typed policy command without mutating the world", () => {
    const world = createTestWorld("policy-dialog");
    const card = world.cards["card-fire-cub"]!;
    const fireDeck = world.decks["deck-fire-fixture"]!;
    world.meta.deckStats[fireDeck.id] = {
      matches: 20,
      wins: 13,
      losses: 7,
      observedWinRate: 0.65,
      usageRate: 0.42,
      averageGameLength: 8,
      sampleCount: 20,
      confidence: "MEDIUM",
    };
    const printing = printingId("printing-fire-cub-first");
    world.printings[printing] = {
      id: printing,
      cardId: card.id,
      expansionId: world.expansions["set-launch"]!.id,
      edition: "FIRST_EDITION",
      sourceProductId: world.products["product-launch-booster"]!.id,
      sourceExpansionId: world.expansions["set-launch"]!.id,
    };
    world.market.snapshots[printing] = {
      printingId: printing,
      lastPrice: 12.5,
      dailyVolume: 7,
      availableSupply: 18,
      liquidity: 0.7,
      priceHistory: [],
    };
    world.history.events.push({
      id: "tournament-completed-policy",
      day: 12,
      type: "TOURNAMENT_COMPLETED",
      context: {
        reason: JSON.stringify({
          tournamentId: "tournament-policy",
          name: "Publisher Open",
          top8: [{ placement: 1, playerId: "player-1", deckId: fireDeck.id }],
        }),
      },
    });
    const before = structuredClone(world);
    const queued: PublisherCommand[] = [];

    render(
      <PolicyDialog
        context={selectPolicyCardContext(world, card.id)}
        queueCommand={(command) => queued.push(command)}
      />,
    );

    expect(screen.getByText("42.0% usage")).toBeTruthy();
    expect(screen.getByText("65.0% observed win rate")).toBeTruthy();
    expect(screen.getByText("$12.50 market price")).toBeTruthy();
    expect(
      screen.getByText("1 Top 8 appearance in 1 completed tournament"),
    ).toBeTruthy();
    expect(screen.queryByText(/optimal|recommend/i)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Ban" }));
    fireEvent.click(screen.getByRole("radio", { name: "Emergency" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Queue policy change" }),
    );

    expect(queued).toEqual([
      { type: "SCHEDULE_BAN", cardId: card.id, timing: "EMERGENCY" },
    ]);
    expect(world).toEqual(before);
  });
});
