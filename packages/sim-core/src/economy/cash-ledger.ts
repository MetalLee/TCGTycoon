import type { CashLedgerEntry, CashState } from "@tcgtycoon/domain";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function appendCashEntry(
  state: CashState,
  entry: CashLedgerEntry,
): void {
  if (!Number.isInteger(entry.day) || entry.day < 0) {
    throw new RangeError(
      "Cash Ledger entry day must be a non-negative integer",
    );
  }
  if (!Number.isFinite(entry.amount)) {
    throw new RangeError("Cash Ledger entry amount must be finite");
  }
  if (!Number.isFinite(state.balance)) {
    throw new RangeError(
      "Cash balance must be finite before applying an entry",
    );
  }

  const nextBalance = roundCurrency(state.balance + entry.amount);
  if (!Number.isFinite(nextBalance)) {
    throw new RangeError("Cash balance must remain finite");
  }

  state.ledger.push({ ...entry });
  state.balance = nextBalance;
}

export function toCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Currency value must be finite");
  }
  return roundCurrency(value);
}
