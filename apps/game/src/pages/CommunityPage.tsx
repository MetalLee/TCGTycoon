import { useState } from "react";
import { useOutletContext } from "react-router";
import type { PublisherCommand } from "../../../../packages/domain/src/index";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { CommunityFeed } from "../features/community/CommunityFeed";
import { OfficialAnnouncementDialog } from "../features/community/OfficialAnnouncementDialog";
import { selectCommunityPosts } from "../selectors/community";

type Outlet = GameSessionSnapshot & {
  queueCommand?: (command: PublisherCommand) => void;
};

export function CommunityPage() {
  const outlet = useOutletContext<Outlet>();
  const [announcing, setAnnouncing] = useState(false);
  return (
    <section className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Community</h1>
          <p className="mt-2 text-slate-400">
            Deterministic template posts derived from structured world events.
          </p>
        </div>
        {outlet.queueCommand && (
          <button
            type="button"
            className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
            onClick={() => setAnnouncing(true)}
          >
            Official announcement
          </button>
        )}
      </header>
      {announcing && outlet.queueCommand && (
        <OfficialAnnouncementDialog
          queueCommand={outlet.queueCommand}
          onClose={() => setAnnouncing(false)}
        />
      )}
      {outlet.world === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          Load a save to view the community feed.
        </p>
      ) : (
        <CommunityFeed posts={selectCommunityPosts(outlet.world as never)} />
      )}
    </section>
  );
}
