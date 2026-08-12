import { RouterProvider } from "react-router";
import { appRouter } from "./router";

export function GameApp() {
  return <RouterProvider router={appRouter} />;
}
