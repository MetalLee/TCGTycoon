import { Link, useOutletContext } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";

export function HistoryPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const events = [...(snapshot.world?.history.events ?? [])].sort(
    (left, right) => right.day - left.day || (left.id < right.id ? -1 : 1),
  );
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">History</h1>
      {events.length === 0 ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          No recorded milestones yet.
        </p>
      ) : (
        <ol className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded border border-slate-800 p-4">
              <p className="font-semibold">
                Day {event.day} · {event.type}
              </p>
              {event.context?.productId !== undefined && (
                <Link
                  className="text-emerald-300"
                  to={`/products/${event.context.productId}`}
                >
                  Open product
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
