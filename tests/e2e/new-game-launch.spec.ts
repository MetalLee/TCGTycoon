import { expect, test } from "@playwright/test";

test("New Game launches a canonical Day 1 session without network AI", async ({
  page,
}) => {
  await page.goto("/new-game");

  await page.getByLabel("Name").fill("E2E Publisher");
  await page.getByRole("button", { name: "Review Launch cards" }).click();
  await expect(page.getByLabel("Launch card").locator("option")).toHaveCount(
    48,
  );
  await page
    .getByRole("button", { name: "Configure launch production" })
    .click();
  await page.getByRole("button", { name: "Launch and enter Day 1" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByText("Day", { exact: true }).locator("../.."),
  ).toContainText("1");
  await expect(page.getByRole("button", { name: "End Day" })).toBeEnabled();
});
