import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "../components/layout/AppShell";
import { CardDetailPage } from "../pages/CardDetailPage";
import { CardsPage } from "../pages/CardsPage";
import { DailyReportPage } from "../pages/DailyReportPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ExpansionDetailPage } from "../pages/ExpansionDetailPage";
import { ExpansionsPage } from "../pages/ExpansionsPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { NewGamePage } from "../pages/NewGamePage";
import { PlaytestPage } from "../pages/PlaytestPage";
import { PlaytestReportPage } from "../pages/PlaytestReportPage";

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
      { path: "cards", element: <CardsPage /> },
      { path: "cards/:cardId", element: <CardDetailPage /> },
      { path: "expansions", element: <ExpansionsPage /> },
      { path: "expansions/:setId", element: <ExpansionDetailPage /> },
      { path: "playtest", element: <PlaytestPage /> },
      { path: "playtest/:reportId", element: <PlaytestReportPage /> },
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
