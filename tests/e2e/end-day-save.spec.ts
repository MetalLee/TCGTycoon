import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("End Day commits atomically and the saved day reloads", async ({
  page,
}) => {
  await launchOfflineGame(page, "Save Publisher");
  await page.getByRole("link", { name: "Community" }).click();
  await page.getByRole("button", { name: "Official announcement" }).click();
  await page
    .getByLabel("Announcement text")
    .fill("Day one operations are underway.");
  await page.getByRole("button", { name: "Queue announcement" }).click();
  await endDay(page);
  await expect(
    page.getByRole("heading", { name: "Daily Report" }),
  ).toBeVisible();
  await expect(
    page.getByText("Day", { exact: true }).locator("../.."),
  ).toContainText("2");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Daily Report" }),
  ).toBeVisible();
  await page.goto("/new-game");
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText("Day", { exact: true }).locator("../.."),
  ).toContainText("2");
});
