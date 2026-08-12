import { agentId } from "../../../../packages/domain/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { AgentProfile } from "../features/community/AgentProfile";
import { selectAgentProfile } from "../selectors/community";

export function AgentProfilePage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { agentId: routeAgentId } = useParams();
  const view =
    snapshot.world === null || routeAgentId === undefined
      ? null
      : selectAgentProfile(snapshot.world as never, agentId(routeAgentId));
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Agent Profile</h1>
      {view === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          This agent is not available in the current session.
        </p>
      ) : (
        <AgentProfile view={view} />
      )}
    </section>
  );
}
