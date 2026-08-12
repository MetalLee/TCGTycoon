import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "../components/layout/AppShell";
import { DailyReportPage } from "../pages/DailyReportPage";
import { DashboardPage } from "../pages/DashboardPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { NewGamePage } from "../pages/NewGamePage";

function page(path: string, title: string): RouteObject {
  return { path, element: <PlaceholderPage title={title} /> };
}

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "new-game", element: <NewGamePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      page("cards", "Cards"),
      page("cards/:cardId", "Card Details"),
      page("expansions", "Expansions"),
      page("expansions/:setId", "Expansion Details"),
      page("playtest", "Playtest"),
      page("playtest/:reportId", "Playtest Report"),
      page("meta", "Meta"),
      page("meta/decks/:deckId", "Deck Details"),
      page("matches/:matchId", "Match Replay"),
      page("market", "Market"),
      page("products/:productId", "Product Details"),
      page("community", "Community"),
      page("agents/:agentId", "Agent Profile"),
      page("tournaments", "Tournaments"),
      page("tournaments/:tournamentId", "Tournament Details"),
      page("operations", "Operations"),
      { path: "daily-report/:day", element: <DailyReportPage /> },
      page("history", "History"),
      page("settings", "Settings"),
      page("*", "Not Found"),
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
