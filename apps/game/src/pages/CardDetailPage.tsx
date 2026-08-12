import { cardId } from "../../../../packages/domain/src/index";
import { Link, useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { CardDetail } from "../features/cards/CardDetail";
import { selectCardDetail } from "../selectors/cards";
import type { MatchReplay as PersistedMatchReplay } from "../../../../packages/rules-engine/src/index";

function replayUsingCard(
  world: NonNullable<GameSessionSnapshot["world"]>,
  card: string,
): string | null {
  for (const event of world.history.events) {
    if (
      event.type !== "TOURNAMENT_COMPLETED" ||
      event.context?.reason === undefined
    )
      continue;
    try {
      const result = JSON.parse(event.context.reason) as {
        matches?: Array<{ id: string; replay?: PersistedMatchReplay }>;
      };
      const match = result.matches?.find(
        (candidate) =>
          candidate.replay !== undefined &&
          [
            ...candidate.replay.deckA.cards,
            ...candidate.replay.deckB.cards,
          ].some((entry) => entry.cardId === card),
      );
      if (match !== undefined) return match.id;
    } catch {
      continue;
    }
  }
  return null;
}

export function CardDetailPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { cardId: routeCardId } = useParams();
  const view =
    snapshot.world === null || routeCardId === undefined
      ? null
      : selectCardDetail(snapshot.world, cardId(routeCardId));
  const replayId =
    view === null || snapshot.world === null
      ? null
      : replayUsingCard(snapshot.world, view.card.id);
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Card Details</h1>
      {view === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-300">
          This CardDefinition is not available in the current session.
        </p>
      ) : (
        <>
          <CardDetail view={view} />
          {snapshot.world !== null &&
            Object.values(snapshot.world.decks)
              .filter((deck) =>
                deck.cards.some((entry) => entry.cardId === view.card.id),
              )
              .map((deck) => (
                <Link
                  key={deck.id}
                  className="mr-3 text-emerald-300"
                  to={`/meta/decks/${deck.id}`}
                >
                  Inspect affected deck {deck.id}
                </Link>
              ))}
          {replayId !== null && (
            <Link className="text-emerald-300" to={`/matches/${replayId}`}>
              Watch match replay featuring this card
            </Link>
          )}
        </>
      )}
    </section>
  );
}
