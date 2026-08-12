import { useState } from "react";
import type {
  PolicyTiming,
  PublisherCommand,
} from "../../../../../packages/domain/src/index";
import type { PolicyCardContext } from "../../selectors/meta";

export type PolicyDialogProps = {
  context: PolicyCardContext;
  queueCommand: (command: PublisherCommand) => void;
  onClose?: () => void;
};

export function PolicyDialog({
  context,
  queueCommand,
  onClose,
}: PolicyDialogProps) {
  const [kind, setKind] = useState<"BAN" | "RESTRICTION">("RESTRICTION");
  const [timing, setTiming] = useState<PolicyTiming>("SCHEDULED");
  const tournamentLabel = `${context.completedTournamentCount} completed tournament${context.completedTournamentCount === 1 ? "" : "s"}`;

  return (
    <section
      role="dialog"
      aria-labelledby="policy-dialog-title"
      className="space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-5"
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Publisher policy
        </p>
        <h2 id="policy-dialog-title" className="mt-1 text-xl font-semibold">
          Review {context.cardName}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Observed context describes the live world; the policy decision remains
          yours.
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Usage</dt>
          <dd>{(context.usageRate * 100).toFixed(1)}% usage</dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Performance</dt>
          <dd>
            {(context.observedWinRate * 100).toFixed(1)}% observed win rate
          </dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Secondary market</dt>
          <dd>
            {context.marketPrice === null
              ? "No market price"
              : `$${context.marketPrice.toFixed(2)} market price`}
          </dd>
        </div>
        <div className="rounded border border-slate-800 p-3">
          <dt className="text-xs text-slate-400">Tournament record</dt>
          <dd>
            {context.top8Appearances} Top 8 appearance
            {context.top8Appearances === 1 ? "" : "s"} in {tournamentLabel}
          </dd>
        </div>
      </dl>

      <fieldset className="flex gap-4">
        <legend className="mb-2 text-sm font-medium">Policy</legend>
        <label>
          <input
            type="radio"
            name="policy-kind"
            checked={kind === "BAN"}
            onChange={() => setKind("BAN")}
          />{" "}
          Ban
        </label>
        <label>
          <input
            type="radio"
            name="policy-kind"
            checked={kind === "RESTRICTION"}
            onChange={() => setKind("RESTRICTION")}
          />{" "}
          Restrict
        </label>
      </fieldset>
      <fieldset className="flex gap-4">
        <legend className="mb-2 text-sm font-medium">Timing</legend>
        <label>
          <input
            type="radio"
            name="policy-timing"
            checked={timing === "SCHEDULED"}
            onChange={() => setTiming("SCHEDULED")}
          />{" "}
          Scheduled
        </label>
        <label>
          <input
            type="radio"
            name="policy-timing"
            checked={timing === "EMERGENCY"}
            onChange={() => setTiming("EMERGENCY")}
          />{" "}
          Emergency
        </label>
      </fieldset>
      <div className="flex justify-end gap-3">
        {onClose && (
          <button
            type="button"
            className="rounded border border-slate-700 px-4 py-2"
            onClick={onClose}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
          onClick={() => {
            queueCommand({
              type: kind === "BAN" ? "SCHEDULE_BAN" : "SCHEDULE_RESTRICTION",
              cardId: context.cardId,
              timing,
            });
            onClose?.();
          }}
        >
          Queue policy change
        </button>
      </div>
    </section>
  );
}
