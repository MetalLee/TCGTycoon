import { Hono } from "hono";
import { errorHandler } from "./middleware/errors";
import type { GenerativeProvider } from "./providers/types";
import { registerArtRoute } from "./routes/art";
import { registerCardsRoute } from "./routes/cards";
import { registerCommunityRoute } from "./routes/community";
import { registerSetsRoute } from "./routes/sets";
import { registerWorldRoute } from "./routes/world";

export function createApp(provider: GenerativeProvider): Hono {
  const app = new Hono();

  app.onError(errorHandler);
  registerWorldRoute(app, provider);
  registerCardsRoute(app, provider);
  registerSetsRoute(app, provider);
  registerCommunityRoute(app, provider);
  registerArtRoute(app, provider);

  return app;
}
