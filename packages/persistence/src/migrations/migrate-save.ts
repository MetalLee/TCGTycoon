import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
import { parseSaveEnvelopeV1 } from "./v1";
import { migrateV1ToV2, parseSaveEnvelopeV2 } from "./v2";

export const CURRENT_SCHEMA_VERSION = 2;

const versionSchema = z
  .object({ schemaVersion: z.number().int().nonnegative() })
  .passthrough();

export function migrateSave(input: unknown): SaveEnvelope {
  const { schemaVersion } = versionSchema.parse(input);
  switch (schemaVersion) {
    case 1:
      return migrateV1ToV2(parseSaveEnvelopeV1(input));
    case CURRENT_SCHEMA_VERSION:
      return parseSaveEnvelopeV2(input);
    default:
      throw new Error(`Unsupported save schema version: ${schemaVersion}`);
  }
}
