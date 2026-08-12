import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { GameSessionSnapshot } from "../../app/game-session/GameSessionController";
import { selectTournaments } from "../tournaments/tournament-model";

type SearchWorld = NonNullable<GameSessionSnapshot["world"]>;
type SearchItem = Readonly<{
  id: string;
  kind: string;
  label: string;
  href: string;
}>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function indexWorld(world: SearchWorld | null): SearchItem[] {
  if (world === null) return [];
  const mutableWorld = world as unknown as Parameters<
    typeof selectTournaments
  >[0];
  return [
    ...Object.values(world.cards).map((card) => ({
      id: card.id,
      kind: "Card",
      label: card.name,
      href: `/cards/${card.id}`,
    })),
    ...Object.values(world.expansions).map((expansion) => ({
      id: expansion.id,
      kind: "Expansion",
      label: expansion.name,
      href: `/expansions/${expansion.id}`,
    })),
    ...Object.values(world.agents).map((agent) => ({
      id: agent.id,
      kind: "Agent",
      label: agent.name,
      href: `/agents/${agent.id}`,
    })),
    ...Object.values(world.decks).map((deck) => ({
      id: deck.id,
      kind: "Deck",
      label: `${deck.factionId} deck ${deck.id}`,
      href: `/meta/decks/${deck.id}`,
    })),
    ...selectTournaments(mutableWorld).map((tournament) => ({
      id: tournament.id,
      kind: "Tournament",
      label: tournament.name,
      href: `/tournaments/${tournament.id}`,
    })),
  ].sort(
    (left, right) =>
      compareText(left.kind, right.kind) ||
      compareText(left.label, right.label) ||
      compareText(left.id, right.id),
  );
}

export type CommandPaletteProps = { world: SearchWorld | null };

export function CommandPalette({ world }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const index = useMemo(() => indexWorld(world), [world]);
  const results =
    query.trim() === ""
      ? index.slice(0, 10)
      : index
          .filter((item) =>
            `${item.kind} ${item.label} ${item.id}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .slice(0, 20);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-slate-950/80 p-8"
      onMouseDown={() => setOpen(false)}
    >
      <section
        role="dialog"
        aria-label="Command palette"
        className="h-fit w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          aria-label="Search publisher data"
          placeholder="Search cards, expansions, agents, decks, tournaments…"
          className="w-full rounded border border-slate-700 bg-slate-950 p-3"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="mt-3 max-h-96 overflow-auto">
          {results.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                className="flex w-full justify-between rounded p-3 text-left hover:bg-slate-800"
                onClick={() => {
                  navigate(item.href);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{item.label}</span>
                <span className="text-xs text-slate-500">{item.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
