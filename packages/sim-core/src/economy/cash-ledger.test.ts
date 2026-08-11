import type { CashState } from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { appendCashEntry } from "./cash-ledger";

describe("appendCashEntry", () => {
  it("updates cash only by appending validated ledger entries", () => {
    const cash: CashState = { balance: 100, ledger: [] };

    appendCashEntry(cash, {
      day: 3,
      category: "BOOSTER_REVENUE",
      sourceId: "product-launch-booster",
      amount: 65,
    });
    appendCashEntry(cash, {
      day: 3,
      category: "OPERATING_COST",
      amount: -20,
    });

    expect(cash.balance).toBe(145);
    expect(cash.ledger).toEqual([
      {
        day: 3,
        category: "BOOSTER_REVENUE",
        sourceId: "product-launch-booster",
        amount: 65,
      },
      { day: 3, category: "OPERATING_COST", amount: -20 },
    ]);
  });

  it("rejects non-finite ledger amounts without changing cash", () => {
    const cash: CashState = { balance: 100, ledger: [] };

    expect(() =>
      appendCashEntry(cash, {
        day: 3,
        category: "INVENTORY_COST",
        amount: Number.NaN,
      }),
    ).toThrow(/finite/);
    expect(cash).toEqual({ balance: 100, ledger: [] });
  });
});
