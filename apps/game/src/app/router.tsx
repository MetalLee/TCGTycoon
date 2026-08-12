import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import type { GameSessionController } from "./game-session/GameSessionController";
import type { SaveRepository } from "../../../../packages/persistence/src/index";
import { AppShell } from "../components/layout/AppShell";
import { CardDetailPage } from "../pages/CardDetailPage";
import { CardsPage } from "../pages/CardsPage";
import { DailyReportPage } from "../pages/DailyReportPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DeckDetailPage } from "../pages/DeckDetailPage";
import { ExpansionDetailPage } from "../pages/ExpansionDetailPage";
import { ExpansionsPage } from "../pages/ExpansionsPage";
import { AgentProfilePage } from "../pages/AgentProfilePage";
import { CommunityPage } from "../pages/CommunityPage";
import { MarketPage } from "../pages/MarketPage";
import { MatchReplayPage } from "../pages/MatchReplayPage";
import { MetaPage } from "../pages/MetaPage";
import { OperationsPage } from "../pages/OperationsPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { HistoryPage } from "../pages/HistoryPage";
import { SettingsPage } from "../pages/SettingsPage";
import { NewGamePage } from "../pages/NewGamePage";
import { PlaytestPage } from "../pages/PlaytestPage";
import { PlaytestReportPage } from "../pages/PlaytestReportPage";
import { PrintingDetailPage } from "../pages/PrintingDetailPage";
import { ProductDetailPage } from "../pages/ProductDetailPage";
import { TournamentDetailPage } from "../pages/TournamentDetailPage";
import { TournamentsPage } from "../pages/TournamentsPage";

function page(path: string, title: string): RouteObject {
  return { path, element: <PlaceholderPage title={title} /> };
}

export function createAppRoutes(
  controller?: GameSessionController,
  saveRepository?: SaveRepository,
): RouteObject[] {
  return [
    {
      element: (
        <AppShell
          {...(controller === undefined ? {} : { controller })}
          {...(saveRepository === undefined ? {} : { saveRepository })}
        />
      ),
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
        { path: "meta", element: <MetaPage /> },
        { path: "meta/decks/:deckId", element: <DeckDetailPage /> },
        { path: "matches/:matchId", element: <MatchReplayPage /> },
        { path: "market", element: <MarketPage /> },
        { path: "products/:productId", element: <ProductDetailPage /> },
        { path: "printings/:printingId", element: <PrintingDetailPage /> },
        { path: "community", element: <CommunityPage /> },
        { path: "agents/:agentId", element: <AgentProfilePage /> },
        { path: "tournaments", element: <TournamentsPage /> },
        {
          path: "tournaments/:tournamentId",
          element: <TournamentDetailPage />,
        },
        { path: "operations", element: <OperationsPage /> },
        { path: "daily-report/:day", element: <DailyReportPage /> },
        { path: "history", element: <HistoryPage /> },
        { path: "settings", element: <SettingsPage /> },
        page("*", "Not Found"),
      ],
    },
  ];
}

export function createAppRouter(
  controller?: GameSessionController,
  saveRepository?: SaveRepository,
) {
  return createBrowserRouter(createAppRoutes(controller, saveRepository));
}

export const appRoutes = createAppRoutes();
export const appRouter = createAppRouter();
