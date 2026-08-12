import { cardId } from "../../../../packages/domain/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { CardDetail } from "../features/cards/CardDetail";
import { selectCardDetail } from "../selectors/cards";

export function CardDetailPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { cardId: routeCardId } = useParams();
  const view =
    snapshot.world === null || routeCardId === undefined
      ? null
      : selectCardDetail(snapshot.world, cardId(routeCardId));
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Card Details</h1>
      {view === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          This CardDefinition is not available in the current session.
        </p>
      ) : (
        <CardDetail view={view} />
      )}
    </section>
  );
}
