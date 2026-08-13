import { pathToFileURL } from "node:url";

import {
  parseLongSimulationArgs,
  runManySimulations,
  summarizeLongSimulationReport,
} from "./run-long-simulations";

export async function validateBalance(argv: readonly string[]): Promise<void> {
  const report = await runManySimulations(parseLongSimulationArgs(argv));
  process.stdout.write(
    `${JSON.stringify(summarizeLongSimulationReport(report))}\n`,
  );
  if (report.invalidSeeds.length > 0 || report.crashedSeeds.length > 0) {
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1];
if (
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  void validateBalance(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
