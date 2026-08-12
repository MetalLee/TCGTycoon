import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  type RouteObject,
} from "react-router";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { useUiStore } from "../state/ui-store";

const navigation = [
  ["/dashboard", "Dashboard"],
  ["/cards", "Cards"],
  ["/expansions", "Expansions"],
  ["/meta", "Meta"],
  ["/market", "Market"],
  ["/community", "Community"],
  ["/tournaments", "Tournaments"],
  ["/operations", "Operations"],
  ["/history", "History"],
  ["/settings", "Settings"],
] as const;

function AppShell() {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside
        aria-label="Publisher navigation"
        className={`fixed inset-y-0 left-0 border-r border-slate-800 bg-slate-900 p-4 transition-[width] ${sidebarCollapsed ? "w-20" : "w-64"}`}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          <span className={sidebarCollapsed ? "sr-only" : "font-semibold"}>
            TCGTycoon
          </span>
          <button
            type="button"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className="rounded border border-slate-700 px-2 py-1"
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? ">" : "<"}
          </button>
        </div>
        <nav className="space-y-1">
          {navigation.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              {sidebarCollapsed ? label.slice(0, 1) : label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={sidebarCollapsed ? "ml-20 p-8" : "ml-64 p-8"}>
        <Outlet />
      </main>
    </div>
  );
}

function page(path: string, title: string): RouteObject {
  return { path, element: <PlaceholderPage title={title} /> };
}

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      page("new-game", "New Game"),
      page("dashboard", "Dashboard"),
      page("cards", "Cards"),
      page("cards/:cardId", "Card Details"),
      page("expansions", "Expansions"),
      page("expansions/:setId", "Expansion Details"),
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
      page("daily-report/:day", "Daily Report"),
      page("history", "History"),
      page("settings", "Settings"),
      page("*", "Not Found"),
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
