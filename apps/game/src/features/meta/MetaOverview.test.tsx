// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { createTestWorld } from "../../../../../packages/testkit/src/index";
import { afterEach, describe, expect, it } from "vitest";
import { selectMetaOverview } from "../../selectors/meta";
import { MetaOverview } from "./MetaOverview";

afterEach(cleanup);

describe("MetaOverview", () => {
  it("shows sample confidence and the measured contributors to Meta Health", () => {
    const world = createTestWorld("meta-overview");
    world.metrics.metaHealth = 41;
    world.metrics.accessibility = 62;
    world.meta.deckStats = {
      "deck-fire-fixture": {
        matches: 8,
        wins: 5,
        losses: 3,
        observedWinRate: 0.625,
        usageRate: 0.64,
        averageGameLength: 8.5,
        sampleCount: 8,
        confidence: "LOW",
      },
      "deck-machine-fixture": {
        matches: 4,
        wins: 1,
        losses: 3,
        observedWinRate: 0.25,
        usageRate: 0.36,
        averageGameLength: 10,
        sampleCount: 4,
        confidence: "VERY_LOW",
      },
    };
    world.meta.matchups = {
      fixture: {
        deckAId: world.decks["deck-fire-fixture"]!.id,
        deckBId: world.decks["deck-machine-fixture"]!.id,
        matches: 6,
        deckAWins: 5,
        deckBWins: 1,
        observedDeckAWinRate: 5 / 6,
        sampleCount: 6,
        confidence: "LOW",
      },
    };

    render(
      <MemoryRouter>
        <MetaOverview view={selectMetaOverview(world)} />
      </MemoryRouter>,
    );

    const fireDeck = screen.getByTestId("meta-deck-deck-fire-fixture");
    expect(within(fireDeck).getByText("8 observed matches")).toBeTruthy();
    expect(within(fireDeck).getByText("Low confidence")).toBeTruthy();

    const diagnostics = screen.getByRole("list", {
      name: "Meta Health contributors",
    });
    for (const contributor of [
      "Diversity",
      "Dominance",
      "Win-rate balance",
      "Matchup balance",
      "Accessibility",
    ]) {
      const row = within(diagnostics).getByTestId(
        `meta-health-${contributor.toLowerCase().replaceAll(" ", "-")}`,
      );
      expect(within(row).getByText(contributor)).toBeTruthy();
      expect(within(row).getByText(/Measured contribution:/)).toBeTruthy();
      expect(within(row).getAllByText(/\d+%/).length).toBeGreaterThan(0);
    }
  });
});
