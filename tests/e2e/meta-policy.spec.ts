import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("an emergency ban changes canonical card legality", async ({ page }) => {
  await launchOfflineGame(page, "Policy Publisher");
  await page.getByRole("link", { name: "Tournaments" }).click();
  await page.getByLabel("Tournament name").fill("Policy Evidence Open");
  await page.getByRole("button", { name: "Queue tournament" }).click();

  await endDay(page);
  await endDay(page);
  await endDay(page);
  await page.getByRole("link", { name: "Tournaments" }).click();
  await page.getByRole("tab", { name: "Completed" }).click();
  await page.getByRole("link", { name: "Policy Evidence Open" }).click();
  const winner = page.getByRole("listitem").filter({ hasText: "#1" });
  const winningDeckHref = await winner.getByRole("link").getAttribute("href");
  expect(winningDeckHref).toBeTruthy();

  await endDay(page);
  await page.getByRole("link", { name: /Meta Health/ }).click();
  await page.locator(`a[href="${winningDeckHref}"]`).click();
  const cardLink = page.locator('a[href^="/cards/"]').first();
  const cardName = await cardLink.textContent();
  expect(cardName).toBeTruthy();
  await cardLink.click();
  await page
    .getByRole("link", { name: "Watch match replay featuring this card" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Match Replay" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Step" }).click();
  await expect(
    page.getByLabel("Action timeline").getByRole("listitem"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Operations" }).click();

  const cardSelect = page.getByLabel("Policy card");
  await cardSelect.selectOption({ label: cardName!.trim() });
  await page.getByLabel("Ban").check();
  await page.getByLabel("Emergency").check();
  await page.getByRole("button", { name: "Queue policy change" }).click();

  await endDay(page);
  await endDay(page);
  await page.getByRole("link", { name: "Cards" }).click();
  await page.getByLabel("Legality").selectOption("BANNED");
  await expect(
    page.getByRole("cell", { name: cardName!.trim() }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "BANNED" })).toBeVisible();
});
