import { deckId } from "../../../../packages/domain/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { DeckDetail } from "../features/meta/DeckDetail";
import { selectDeckDetail } from "../selectors/meta";

export function DeckDetailPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { deckId: routeDeckId } = useParams();
  const view =
    snapshot.world === null || routeDeckId === undefined
      ? null
      : selectDeckDetail(snapshot.world as never, deckId(routeDeckId));
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Deck Details</h1>
      {view === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          This deck is not available in the current session.
        </p>
      ) : (
        <DeckDetail view={view} />
      )}
    </section>
  );
}
