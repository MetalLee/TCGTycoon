import type { ApiConfig } from "../config";
import { MockGenerativeProvider } from "./mock-provider";
import type { GenerativeProvider } from "./types";

export function createGenerativeProvider(
  config: Pick<ApiConfig, "aiMode">,
): GenerativeProvider {
  switch (config.aiMode) {
    case "mock":
      return new MockGenerativeProvider();
  }
}
