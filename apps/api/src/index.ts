import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createGenerativeProvider } from "./providers/provider-factory";

const config = loadConfig();
const app = createApp(createGenerativeProvider(config));

serve({
  fetch: app.fetch,
  port: config.port,
});
