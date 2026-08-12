import { printingId } from "../../../../packages/domain/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { PrintingDetail } from "../features/market/PrintingDetail";
import { selectPrintingDetail } from "../selectors/market";

export function PrintingDetailPage() {
  const snapshot = useOutletContext<GameSessionSnapshot>();
  const { printingId: routePrintingId } = useParams();
  const view =
    snapshot.world === null || routePrintingId === undefined
      ? null
      : selectPrintingDetail(
          snapshot.world as never,
          printingId(routePrintingId),
        );
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Printing Details</h1>
      {view === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          This printing is not available in the current session.
        </p>
      ) : (
        <PrintingDetail view={view} />
      )}
    </section>
  );
}
