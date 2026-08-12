import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("a completed tournament exposes its winning deck and match evidence", async ({
  page,
}) => {
  await launchOfflineGame(page, "Tournament Publisher");
  await page.getByRole("link", { name: "Tournaments" }).click();
  await page.getByLabel("Tournament name").fill("Launch Shock");
  await page.getByRole("button", { name: "Queue tournament" }).click();

  await endDay(page);
  await endDay(page);
  await endDay(page);
  await page.getByRole("link", { name: "Tournaments" }).click();
  await page.getByRole("tab", { name: "Completed" }).click();
  await page.getByRole("link", { name: "Launch Shock" }).click();

  const winner = page.getByRole("listitem").filter({ hasText: "#1" });
  await expect(winner.getByRole("link")).toBeVisible();
  await expect(page.getByText("Notable matches")).toBeVisible();
  await expect(page.getByRole("link", { name: /Final/ })).toBeVisible();
});
