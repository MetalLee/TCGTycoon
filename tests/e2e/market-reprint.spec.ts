import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("a queued reprint creates a due Print Run in Operations", async ({
  page,
}) => {
  await launchOfflineGame(page, "Reprint Publisher");
  await page.getByRole("link", { name: "Market" }).click();
  await page.locator("main article a").first().click();
  await page
    .getByRole("button", { name: "Queue 1,000-unit print run" })
    .click();

  await endDay(page);
  await page.getByRole("link", { name: "Operations" }).click();
  await expect(page.getByText(/Print run .*PRINTING/i)).toBeVisible();
});
