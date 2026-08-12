import {
  productId,
  type PublisherCommand,
} from "../../../../packages/domain/src/index";
import { useOutletContext, useParams } from "react-router";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { ProductDetail } from "../features/market/ProductDetail";
import { selectProductDetail } from "../selectors/market";

type Outlet = GameSessionSnapshot & {
  queueCommand?: (command: PublisherCommand) => void;
};

export function ProductDetailPage() {
  const outlet = useOutletContext<Outlet>();
  const { productId: routeProductId } = useParams();
  const view =
    outlet.world === null || routeProductId === undefined
      ? null
      : selectProductDetail(outlet.world as never, productId(routeProductId));
  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Product Details</h1>
      {view === null ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          This product is not available in the current session.
        </p>
      ) : (
        <ProductDetail
          view={view}
          {...(outlet.queueCommand === undefined
            ? {}
            : { queueCommand: outlet.queueCommand })}
        />
      )}
    </section>
  );
}
