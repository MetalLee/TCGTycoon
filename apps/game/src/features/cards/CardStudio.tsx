import { useEffect, useState, type FormEvent } from "react";
import {
  parseCardDefinition,
  type ExpansionId,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";
import type { ExpansionCardDraft } from "../../../../../packages/sim-core/src/index";

export type CardStudioProps = {
  expansionId: ExpansionId;
  draft: Readonly<ExpansionCardDraft>;
  queueCommand: (command: PublisherCommand) => void;
};

export function CardStudio({
  expansionId,
  draft,
  queueCommand,
}: CardStudioProps) {
  const [cost, setCost] = useState(draft.definition.cost);
  const [triggersJson, setTriggersJson] = useState(() =>
    JSON.stringify(draft.definition.triggers, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCost(draft.definition.cost);
    setTriggersJson(JSON.stringify(draft.definition.triggers, null, 2));
    setError(null);
  }, [draft]);

  function queueGameplayEdit(event: FormEvent): void {
    event.preventDefault();
    if (draft.rulesLocked) return;
    try {
      const edited = parseCardDefinition({
        ...structuredClone(draft.definition),
        cost,
        triggers: JSON.parse(triggersJson),
      });
      queueCommand({
        type: "UPDATE_CARD_DRAFT",
        expansionId,
        cardId: draft.definition.id,
        draft: edited,
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <form
      className="space-y-5 rounded-lg border border-slate-800 bg-slate-900/70 p-5"
      onSubmit={queueGameplayEdit}
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Structured card editor
        </p>
        <h2 className="mt-2 text-xl font-semibold">{draft.definition.name}</h2>
        <p className="mt-1 text-sm text-slate-400">
          Gameplay revision {draft.gameplayRevision}
          {draft.rulesLocked ? " · Finalized" : " · Editable draft"}
        </p>
      </header>

      {draft.rulesLocked && (
        <p className="rounded border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">
          Finalize is irreversible. Cost, stats, keywords, and effects are
          rules-locked.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span>Cost</span>
          <input
            aria-label="Cost"
            type="number"
            min={0}
            max={8}
            step={1}
            disabled={draft.rulesLocked}
            value={cost}
            onChange={(event) => setCost(Number(event.target.value))}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 disabled:text-slate-500"
          />
        </label>
        <div className="rounded border border-slate-800 p-3 text-sm">
          <p className="text-slate-400">Card DSL identity</p>
          <p className="mt-1 font-mono text-xs">{draft.definition.id}</p>
          <p className="mt-2">
            {draft.definition.type} · {draft.definition.rarity} ·{" "}
            {draft.definition.factionId}
          </p>
        </div>
      </div>

      <label className="grid gap-1">
        <span>Effects JSON</span>
        <textarea
          aria-label="Effects JSON"
          disabled={draft.rulesLocked}
          value={triggersJson}
          onChange={(event) => setTriggersJson(event.target.value)}
          className="min-h-52 rounded border border-slate-700 bg-slate-950 p-3 font-mono text-xs disabled:text-slate-500"
        />
      </label>

      <button
        type="submit"
        disabled={draft.rulesLocked}
        className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {draft.rulesLocked ? "Gameplay rules locked" : "Queue gameplay edit"}
      </button>
      {error !== null && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
