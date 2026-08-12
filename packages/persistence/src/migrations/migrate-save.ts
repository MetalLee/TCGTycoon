import type { SaveEnvelope } from "@tcgtycoon/domain";
import { z } from "zod";
import { parseSaveEnvelopeV1 } from "./v1";
import { migrateV1ToV2, parseSaveEnvelopeV2 } from "./v2";
import { migrateV2ToV3, parseSaveEnvelopeV3 } from "./v3";
import { migrateV3ToV4, parseSaveEnvelopeV4 } from "./v4";
import { migrateV4ToV5, parseSaveEnvelopeV5 } from "./v5";
import { migrateV5ToV6, parseSaveEnvelopeV6 } from "./v6";
import { migrateV6ToV7, parseSaveEnvelopeV7 } from "./v7";

export const CURRENT_SCHEMA_VERSION = 7;

const versionSchema = z
  .object({ schemaVersion: z.number().int().nonnegative() })
  .passthrough();

export function migrateSave(input: unknown): SaveEnvelope {
  const { schemaVersion } = versionSchema.parse(input);
  switch (schemaVersion) {
    case 1:
      return migrateV6ToV7(
        migrateV5ToV6(
          migrateV4ToV5(
            migrateV3ToV4(
              migrateV2ToV3(migrateV1ToV2(parseSaveEnvelopeV1(input))),
            ),
          ),
        ),
      );
    case 2:
      return migrateV6ToV7(
        migrateV5ToV6(
          migrateV4ToV5(
            migrateV3ToV4(migrateV2ToV3(parseSaveEnvelopeV2(input))),
          ),
        ),
      );
    case 3:
      return migrateV6ToV7(
        migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(parseSaveEnvelopeV3(input)))),
      );
    case 4:
      return migrateV6ToV7(
        migrateV5ToV6(migrateV4ToV5(parseSaveEnvelopeV4(input))),
      );
    case 5:
      return migrateV6ToV7(migrateV5ToV6(parseSaveEnvelopeV5(input)));
    case 6:
      return migrateV6ToV7(parseSaveEnvelopeV6(input));
    case 7:
      return parseSaveEnvelopeV7(input);
    default:
      throw new Error(`Unsupported save schema version: ${schemaVersion}`);
  }
}
