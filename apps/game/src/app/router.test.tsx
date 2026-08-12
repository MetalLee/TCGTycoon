// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { appRoutes } from "./router";

const routeCases = [
  ["/new-game", "New Game"],
  ["/dashboard", "Dashboard"],
  ["/cards", "Cards"],
  ["/cards/card-001", "Card Details"],
  ["/expansions", "Expansions"],
  ["/expansions/set-001", "Expansion Details"],
  ["/playtest/report-001", "Playtest Report"],
  ["/meta", "Meta"],
  ["/meta/decks/deck-001", "Deck Details"],
  ["/matches/match-001", "Match Replay"],
  ["/market", "Market"],
  ["/products/product-001", "Product Details"],
  ["/community", "Community"],
  ["/agents/agent-001", "Agent Profile"],
  ["/tournaments", "Tournaments"],
  ["/tournaments/tournament-001", "Tournament Details"],
  ["/operations", "Operations"],
  ["/daily-report/42", "Daily Report"],
  ["/history", "History"],
  ["/settings", "Settings"],
] as const;

afterEach(cleanup);

describe("publisher web routes", () => {
  it.each(routeCases)("renders %s", async (path, heading) => {
    const router = createMemoryRouter(appRoutes, { initialEntries: [path] });

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: heading }),
    ).toBeDefined();
  });
});
