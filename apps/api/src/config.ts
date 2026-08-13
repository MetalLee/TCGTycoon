export type AiMode = "mock" | "openai";

type ApiConfigBase = {
  port: number;
  textModel: string;
  imageModel: string;
};

export type ApiConfig =
  | (ApiConfigBase & { aiMode: "mock" })
  | (ApiConfigBase & { aiMode: "openai"; openaiApiKey: string });

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const aiMode = environment.AI_MODE ?? "mock";
  if (aiMode !== "mock" && aiMode !== "openai") {
    throw new Error(`Unsupported AI_MODE: ${aiMode}`);
  }

  const port = Number(environment.PORT ?? 3_001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT: ${environment.PORT ?? ""}`);
  }

  const textModel = environment.OPENAI_TEXT_MODEL ?? "gpt-5";
  const imageModel = environment.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

  if (aiMode === "openai") {
    const openaiApiKey = environment.OPENAI_API_KEY;
    if (openaiApiKey === undefined || openaiApiKey.length === 0) {
      throw new Error("OPENAI_API_KEY is required when AI_MODE=openai");
    }
    return { aiMode, port, openaiApiKey, textModel, imageModel };
  }

  return { aiMode, port, textModel, imageModel };
}
