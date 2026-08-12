import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const desktopRoot = join(repositoryRoot, "apps", "desktop");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("desktop frontend parity", () => {
  it("wraps the shared game app instead of creating another React app", () => {
    const config = readJson<{
      build: {
        beforeDevCommand: string;
        beforeBuildCommand: string;
        devUrl: string;
        frontendDist: string;
      };
    }>(join(desktopRoot, "src-tauri", "tauri.conf.json"));
    const desktopPackage = readJson<{
      scripts: Record<string, string>;
    }>(join(desktopRoot, "package.json"));
    const rootPackage = readJson<{
      scripts: Record<string, string>;
    }>(join(repositoryRoot, "package.json"));

    expect(config.build).toMatchObject({
      beforeDevCommand: "pnpm --dir ../game dev",
      beforeBuildCommand: "pnpm --dir ../game build",
      devUrl: "http://localhost:5173",
      frontendDist: "../../game/dist",
    });
    expect(desktopPackage.scripts).toMatchObject({
      dev: "tauri dev",
      build: "tauri build",
    });
    expect(rootPackage.scripts).toMatchObject({
      "dev:desktop": "pnpm --filter @tcgtycoon/desktop dev",
      "build:desktop": "pnpm --filter @tcgtycoon/desktop build",
    });
    expect(existsSync(join(desktopRoot, "src"))).toBe(false);
    expect(existsSync(join(desktopRoot, "index.html"))).toBe(false);
  });
});
