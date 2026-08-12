import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("a queued reprint creates a due Print Run in Operations", async ({
  page,
}) => {
  await launchOfflineGame(page, "Reprint Publisher", {
    boosterQuantity: 8,
    starterQuantity: 2,
  });
  await endDay(page);
  await page.getByRole("link", { name: "Community" }).click();
  const complaint = page
    .getByText(/hard to find at a reasonable price/i)
    .first();
  await expect(complaint).toBeVisible();
  await complaint
    .locator("xpath=ancestor::li")
    .getByRole("link", { name: /./ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Market" }).click();
  await page.getByRole("link", { name: /Open Market/ }).click();
  await page.locator("main article a").first().click();
  await page
    .getByRole("button", { name: "Queue 1,000-unit print run" })
    .click();

  await endDay(page);
  await page.getByRole("link", { name: "Operations", exact: true }).click();
  await expect(page.getByText(/Print run .*PRINTING/i)).toBeVisible();
});
