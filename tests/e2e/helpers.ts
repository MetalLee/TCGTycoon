import { expect, type Page } from "@playwright/test";

export async function launchOfflineGame(
  page: Page,
  publisherName: string,
  production?: { boosterQuantity: number; starterQuantity: number },
): Promise<void> {
  await page.goto("/new-game");
  await page.getByLabel("Name").fill(publisherName);
  await page.getByRole("button", { name: "Review Launch cards" }).click();
  await page
    .getByRole("button", { name: "Configure launch production" })
    .click();
  if (production !== undefined) {
    await page
      .getByLabel("Booster quantity")
      .fill(String(production.boosterQuantity));
    await page
      .getByLabel("Quantity per Starter")
      .fill(String(production.starterQuantity));
  }
  await page.getByRole("button", { name: "Launch and enter Day 1" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "End Day" })).toBeEnabled();
}

export async function endDay(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End Day" }).click();
  await page.getByRole("button", { name: "Proceed Anyway" }).click();
  await expect(page).toHaveURL(/\/daily-report\/\d+$/);
  await expect(
    page.getByRole("heading", { name: "Daily Report" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "End Day" })).toBeEnabled();
}
