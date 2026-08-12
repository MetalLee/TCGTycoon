import { useEffect, useState, type FormEvent } from "react";
import type { CardProposalResponse } from "../../../../../packages/ai-contracts/src/index";
import {
  parseCardDefinition,
  type ExpansionId,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";
import type { ExpansionCardDraft } from "../../../../../packages/sim-core/src/index";
import { defaultAiClient, type AiClient } from "../../services/ai/ai-client";

export type CardStudioProps = {
  expansionId: ExpansionId;
  draft: Readonly<ExpansionCardDraft>;
  queueCommand: (command: PublisherCommand) => void;
  aiClient?: Pick<AiClient, "proposeCard">;
  setTheme?: string;
  visualKeywords?: readonly string[];
};

export function CardStudio({
  expansionId,
  draft,
  queueCommand,
  aiClient = defaultAiClient,
  setTheme = "Current expansion",
  visualKeywords = [],
}: CardStudioProps) {
  const [cost, setCost] = useState(draft.definition.cost);
  const [triggersJson, setTriggersJson] = useState(() =>
    JSON.stringify(draft.definition.triggers, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [designIntent, setDesignIntent] = useState("");
  const [aiProposal, setAiProposal] = useState<CardProposalResponse | null>(
    null,
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setCost(draft.definition.cost);
    setTriggersJson(JSON.stringify(draft.definition.triggers, null, 2));
    setError(null);
    setAiProposal(null);
    setAiError(null);
  }, [draft]);

  async function requestAiProposal(): Promise<void> {
    if (draft.rulesLocked || designIntent.trim().length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiProposal(null);
    try {
      const response = await aiClient.proposeCard({
        cardId: draft.definition.id,
        factionId: draft.definition.factionId,
        designIntent: designIntent.trim(),
        setTheme,
        visualKeywords: [...visualKeywords],
      });
      const proposal = response.proposal;
      if (
        proposal.id !== draft.definition.id ||
        proposal.factionId !== draft.slot.intendedFactionId ||
        proposal.rarity !== draft.slot.intendedRarity ||
        proposal.type !== draft.slot.intendedCardType
      ) {
        throw new Error("AI proposal changed the fixed card slot identity");
      }
      setAiProposal(response);
    } catch (cause) {
      setAiError(
        `AI assistance unavailable: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setAiLoading(false);
    }
  }

  function acceptAiProposal(): void {
    if (draft.rulesLocked || aiProposal === null) return;
    queueCommand({
      type: "UPDATE_CARD_DRAFT",
      expansionId,
      cardId: draft.definition.id,
      draft: aiProposal.proposal,
    });
  }

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

      <section className="space-y-3 rounded border border-sky-900 bg-sky-950/20 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            Optional AI design assistant
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Suggestions do not change the draft until you accept them.
          </p>
        </div>
        <label className="grid gap-1">
          <span>Design intent</span>
          <textarea
            aria-label="Design intent"
            disabled={draft.rulesLocked}
            value={designIntent}
            onChange={(event) => setDesignIntent(event.target.value)}
            className="min-h-24 rounded border border-slate-700 bg-slate-950 p-3 text-sm disabled:text-slate-500"
          />
        </label>
        <button
          type="button"
          disabled={
            draft.rulesLocked || aiLoading || designIntent.trim().length === 0
          }
          onClick={() => void requestAiProposal()}
          className="rounded border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-200 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {aiLoading ? "Generating proposal..." : "Generate AI proposal"}
        </button>
        {aiProposal !== null && (
          <article className="space-y-3 rounded border border-slate-700 bg-slate-950/60 p-3">
            <h3 className="font-semibold text-sky-200">AI proposal preview</h3>
            <p className="font-medium">{aiProposal.proposal.name}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Opinion - {aiProposal.risk.level} risk
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">
              {JSON.stringify(aiProposal.proposal, null, 2)}
            </pre>
            <button
              type="button"
              onClick={acceptAiProposal}
              className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Accept AI proposal
            </button>
          </article>
        )}
        {aiError !== null && (
          <p role="alert" className="text-sm text-red-300">
            {aiError}
          </p>
        )}
      </section>

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
