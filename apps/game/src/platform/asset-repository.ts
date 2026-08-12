import { isTauri } from "@tauri-apps/api/core";
import {
  DexieAssetRepository,
  SqliteAssetRepository,
  type AssetRepository,
} from "../../../../packages/persistence/src/index";
import { desktopDatabase } from "./sqlite-database";

export const assetRepository: AssetRepository = isTauri()
  ? new SqliteAssetRepository(desktopDatabase)
  : new DexieAssetRepository();
