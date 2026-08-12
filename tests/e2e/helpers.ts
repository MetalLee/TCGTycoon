import { expect, type Page } from "@playwright/test";

export async function launchOfflineGame(
  page: Page,
  publisherName: string,
): Promise<void> {
  await page.goto("/new-game");
  await page.getByLabel("Name").fill(publisherName);
  await page.getByRole("button", { name: "Review Launch cards" }).click();
  await page
    .getByRole("button", { name: "Configure launch production" })
    .click();
  await page.getByRole("button", { name: "Launch and enter Day 1" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "End Day" })).toBeEnabled();
}

export async function endDay(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End Day" }).click();
  await page.getByRole("button", { name: "Proceed Anyway" }).click();
  await expect(page.getByRole("button", { name: "End Day" })).toBeEnabled();
}
