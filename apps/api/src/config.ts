export type AiMode = "mock";

export type ApiConfig = {
  aiMode: AiMode;
  port: number;
};

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const aiMode = environment.AI_MODE ?? "mock";
  if (aiMode !== "mock") {
    throw new Error(`Unsupported AI_MODE: ${aiMode}`);
  }

  const port = Number(environment.PORT ?? 3_001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT: ${environment.PORT ?? ""}`);
  }

  return { aiMode, port };
}
