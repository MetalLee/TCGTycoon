import type { SaveEnvelope } from "@tcgtycoon/domain";
import { parseSaveEnvelopeV1 } from "./v1";
const CURRENT_SCHEMA_VERSION=1;
export function migrateSave(input:unknown):SaveEnvelope { const parsed=parseSaveEnvelopeV1(input); if(parsed.schemaVersion!==CURRENT_SCHEMA_VERSION)throw new Error(`Unsupported save schema version: ${parsed.schemaVersion}`); return parsed; }
