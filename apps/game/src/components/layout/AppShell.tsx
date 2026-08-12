import { useState, useSyncExternalStore } from "react";
import { NavLink, Outlet } from "react-router";
import {
  type GameSessionController,
  type GameSessionSnapshot,
} from "../../app/game-session/GameSessionController";
import { EndDayDialog } from "../../features/end-day/EndDayDialog";
import { useUiStore } from "../../state/ui-store";
import { GlobalHeader } from "./GlobalHeader";

export const primaryNavigation = [
  ["/dashboard", "Dashboard"],
  ["/cards", "Cards"],
  ["/expansions", "Expansions"],
  ["/playtest", "Playtest"],
  ["/meta", "Meta"],
  ["/market", "Market"],
  ["/community", "Community"],
  ["/tournaments", "Tournaments"],
  ["/operations", "Operations"],
] as const;

const emptySnapshot: GameSessionSnapshot = {
  status: "UNLOADED",
  saveId: null,
  world: null,
  pendingCommands: [],
  progress: null,
  error: null,
};

const subscribeToNothing = (): (() => void) => () => undefined;
const getEmptySnapshot = (): GameSessionSnapshot => emptySnapshot;

function useControllerSnapshot(
  controller: GameSessionController | undefined,
): GameSessionSnapshot {
  return useSyncExternalStore(
    controller?.subscribe ?? subscribeToNothing,
    controller?.getSnapshot ?? getEmptySnapshot,
    controller?.getSnapshot ?? getEmptySnapshot,
  );
}

export type AppShellProps = {
  controller?: GameSessionController;
};

export function AppShell({ controller }: AppShellProps) {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const snapshot = useControllerSnapshot(controller);
  const [endDayOpen, setEndDayOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside
        aria-label="Publisher navigation"
        className={`fixed inset-y-0 left-0 z-30 border-r border-slate-800 bg-slate-900 p-4 transition-[width] ${sidebarCollapsed ? "w-20" : "w-64"}`}
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
          {primaryNavigation.map(([to, label]) => (
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
      <div className={sidebarCollapsed ? "ml-20" : "ml-64"}>
        <GlobalHeader
          world={snapshot.world}
          sessionStatus={snapshot.status}
          onEndDay={() => setEndDayOpen(true)}
        />
        <main className="p-8">
          <Outlet context={snapshot} />
        </main>
      </div>
      {endDayOpen && snapshot.world !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4">
          <EndDayDialog
            world={snapshot.world}
            sessionStatus={snapshot.status}
            pendingCommandCount={snapshot.pendingCommands.length}
            onCancel={() => setEndDayOpen(false)}
            onProceed={async () => {
              if (controller === undefined) return;
              await controller.endDay();
              setEndDayOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
