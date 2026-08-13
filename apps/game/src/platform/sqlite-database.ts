import Database from "@tauri-apps/plugin-sql";

export const desktopDatabase = Database.get("sqlite:tcgtycoon.db");
