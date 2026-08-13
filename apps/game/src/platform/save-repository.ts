import { isTauri } from "@tauri-apps/api/core";
import {
  DexieSaveRepository,
  SqliteSaveRepository,
  type SaveRepository,
} from "../../../../packages/persistence/src/index";
import { desktopDatabase } from "./sqlite-database";

export const saveRepository: SaveRepository = isTauri()
  ? new SqliteSaveRepository(desktopDatabase)
  : new DexieSaveRepository();
