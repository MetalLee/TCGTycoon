import { expect, test } from "@playwright/test";
import { endDay, launchOfflineGame } from "./helpers";

test("an offline expansion can be playtested, finalized, printed and released", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await launchOfflineGame(page, "Expansion Publisher");
  await page.getByRole("link", { name: "Expansions" }).click();
  await page
    .getByRole("button", { name: "Queue offline fixture expansion" })
    .click();
  await endDay(page);

  await page.getByRole("link", { name: "Playtest" }).click();
  await page.getByRole("button", { name: "Queue Quick Playtest" }).click();
  await endDay(page);

  await page.getByRole("link", { name: "Expansions" }).click();
  await page.getByRole("link", { name: "Offline Fixture Expansion" }).click();
  await page.getByRole("button", { name: "Edit" }).first().click();
  const cost = page.getByLabel("Cost");
  await cost.fill(String(Number(await cost.inputValue()) + 1));
  await page.getByRole("button", { name: "Queue gameplay edit" }).click();
  await endDay(page);
  await page.getByRole("link", { name: "Playtest" }).click();
  await expect(page.getByRole("link", { name: /QUICK report/ })).toBeVisible();
  await page.getByRole("link", { name: /QUICK report/ }).click();
  await expect(page.getByText("STALE evidence")).toBeVisible();
  await page.getByRole("link", { name: "Expansions" }).click();
  await page.getByRole("link", { name: "Offline Fixture Expansion" }).click();
  await page
    .getByRole("button", { name: "Queue irreversible Finalize" })
    .click();
  await endDay(page);
  await page.getByRole("link", { name: "Expansions" }).click();
  await page.getByRole("link", { name: "Offline Fixture Expansion" }).click();
  await expect(page.getByText("FINALIZED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gameplay finalized" }),
  ).toBeDisabled();

  await page.getByRole("link", { name: "Market" }).click();
  await page
    .getByRole("link", { name: "Offline Fixture Expansion Booster" })
    .click();
  await page
    .getByRole("button", { name: "Queue 1,000-unit print run" })
    .click();
  await page
    .getByRole("button", { name: "Queue release after production" })
    .click();
  await endDay(page);
  for (let day = 0; day < 10; day += 1) await endDay(page);

  await page.getByRole("link", { name: "Expansions" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Offline Fixture Expansion" }),
  ).toContainText("RELEASED");
});
