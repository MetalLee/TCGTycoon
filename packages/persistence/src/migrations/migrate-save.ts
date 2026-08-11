import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
import { parseSaveEnvelopeV1 } from "./v1";
import { migrateV1ToV2, parseSaveEnvelopeV2 } from "./v2";
import { migrateV2ToV3, parseSaveEnvelopeV3 } from "./v3";

export const CURRENT_SCHEMA_VERSION = 3;

const versionSchema = z
  .object({ schemaVersion: z.number().int().nonnegative() })
  .passthrough();

export function migrateSave(input: unknown): SaveEnvelope {
  const { schemaVersion } = versionSchema.parse(input);
  switch (schemaVersion) {
    case 1:
      return migrateV2ToV3(migrateV1ToV2(parseSaveEnvelopeV1(input)));
    case 2:
      return migrateV2ToV3(parseSaveEnvelopeV2(input));
    case 3:
      return parseSaveEnvelopeV3(input);
    default:
      throw new Error(`Unsupported save schema version: ${schemaVersion}`);
  }
}
