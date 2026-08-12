import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("End Day commits atomically and the saved day reloads", async ({
  page,
}) => {
  await launchOfflineGame(page, "Save Publisher");
  await endDay(page);
  await expect(
    page.getByText("Day", { exact: true }).locator("../.."),
  ).toContainText("2");

  await page.reload();
  await page.goto("/new-game");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText("Day", { exact: true }).locator("../.."),
  ).toContainText("2");
});
