import { Link } from "react-router";
import type { AgentProfileView } from "../../selectors/community";
import { CommunityFeed } from "./CommunityFeed";

export type AgentProfileProps = { view: AgentProfileView };

export function AgentProfile({ view }: AgentProfileProps) {
  return (
    <article className="space-y-6">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-wider text-emerald-400">
          {view.agent.role}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{view.agent.name}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">Influence</dt>
            <dd>{(view.agent.influence * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-slate-400">Followers</dt>
            <dd>{view.agent.followers}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Brand attitude</dt>
            <dd>{view.agent.brandAttitude.toFixed(1)}</dd>
          </div>
        </dl>
        {view.currentDeckId && (
          <Link
            className="mt-4 inline-block text-sm text-emerald-300"
            to={`/meta/decks/${view.currentDeckId}`}
          >
            {view.currentDeckName}
          </Link>
        )}
      </header>
      <section className="rounded-xl border border-slate-800 p-5">
        <h3 className="font-semibold">Persistent history</h3>
        <p className="mt-2 text-sm text-slate-300">
          {view.agent.longTermSummary || "No long-term summary yet."}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-400">
          {view.agent.recentMemories.map((memory, index) => (
            <li key={`${index}-${memory}`}>{memory}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">Recent posts</h3>
        <CommunityFeed posts={view.posts} />
      </section>
    </article>
  );
}
