import type { ApiConfig } from "../config";
import OpenAI from "openai";
import { MockGenerativeProvider } from "./mock-provider";
import { OpenAIGenerativeProvider } from "./openai-provider";
import type { GenerativeProvider } from "./types";

export function createGenerativeProvider(
  config: ApiConfig,
): GenerativeProvider {
  switch (config.aiMode) {
    case "mock":
      return new MockGenerativeProvider();
    case "openai":
      return new OpenAIGenerativeProvider(
        new OpenAI({ apiKey: config.openaiApiKey }),
        {
          textModel: config.textModel,
          imageModel: config.imageModel,
        },
      );
  }
}
