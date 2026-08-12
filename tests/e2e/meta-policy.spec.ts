import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("an emergency ban changes canonical card legality", async ({ page }) => {
  await launchOfflineGame(page, "Policy Publisher");
  await page.getByRole("link", { name: "Operations" }).click();

  const cardSelect = page.getByLabel("Policy card");
  await cardSelect.selectOption({ index: 1 });
  const cardName = await cardSelect.locator("option:checked").textContent();
  const selectedCardId = await cardSelect.inputValue();
  expect(cardName).toBeTruthy();
  await page.getByLabel("Ban").check();
  await page.getByLabel("Emergency").check();
  await page.getByRole("button", { name: "Queue policy change" }).click();

  await endDay(page);
  await endDay(page);
  await expect(
    page.getByRole("link", { name: selectedCardId, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Cards" }).click();
  await page.getByLabel("Legality").selectOption("BANNED");
  await expect(page.getByRole("cell", { name: cardName! })).toBeVisible();
  await expect(page.getByRole("cell", { name: "BANNED" })).toBeVisible();
});
