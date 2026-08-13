import { useState } from "react";
import type { SetCardProposal } from "../../../../../packages/ai-contracts/src/index";
import type { CardId } from "../../../../../packages/domain/src/index";
import type { PublisherCommand } from "../../../../../packages/domain/src/index";
import type {
  ExpansionCardDraft,
  ExpansionPipelineProject,
} from "../../../../../packages/sim-core/src/index";
import { validateCardDefinition } from "../../../../../packages/rules-engine/src/index";
import { defaultAiClient, type AiClient } from "../../services/ai/ai-client";

export type ProposalRisk = "LOW" | "REVIEW" | "INVALID";

export type SetReviewProps = {
  project: Readonly<ExpansionPipelineProject>;
  onAccept: (cardId: CardId) => void;
  onEdit: (cardId: CardId) => void;
  queueCommand?: (command: PublisherCommand) => void;
  aiClient?: Pick<AiClient, "completeSet">;
};

export function classifyProposalRisk(
  draft: Readonly<ExpansionCardDraft>,
): ProposalRisk {
  if (!validateCardDefinition(draft.definition).valid) return "INVALID";
  const effectCount = draft.definition.triggers.reduce(
    (total, trigger) => total + trigger.effects.length,
    0,
  );
  return effectCount === 0 && draft.definition.keywords.length <= 1
    ? "LOW"
    : "REVIEW";
}

export function SetReview({
  project,
  onAccept,
  onEdit,
  queueCommand,
  aiClient = defaultAiClient,
}: SetReviewProps) {
  const [aiProposals, setAiProposals] = useState<SetCardProposal[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const drafts = Object.values(project.cardDrafts).sort(
    (left, right) => left.slot.index - right.slot.index,
  );
  const lowRisk = drafts.filter(
    (draft) => !draft.rulesLocked && classifyProposalRisk(draft) === "LOW",
  );
  const projectLocked =
    project.stage === "FINALIZED" ||
    project.stage === "PRINTING" ||
    project.stage === "RELEASED";

  async function requestSetCompletion(): Promise<void> {
    if (queueCommand === undefined || projectLocked) return;
    const editableDrafts = drafts.filter((draft) => !draft.rulesLocked);
    if (editableDrafts.length === 0) return;
    const openSlots = editableDrafts.map((draft) => ({
      slotId: `slot-${draft.slot.index}`,
      cardId: draft.definition.id,
      factionId: draft.slot.intendedFactionId,
      rarity: draft.slot.intendedRarity,
      type: draft.slot.intendedCardType,
      designRole: draft.flavor.displayText || draft.definition.name,
    }));
    const slotsById = new Map(openSlots.map((slot) => [slot.slotId, slot]));
    setAiLoading(true);
    setAiError(null);
    setAiProposals([]);
    try {
      const response = await aiClient.completeSet({
        expansionId: project.id,
        setName: project.name,
        setBrief: [
          project.brief.theme,
          ...project.brief.strategicDirections,
          project.brief.productPositioning,
        ].join("\n"),
        visualKeywords: project.brief.strategicDirections
          .slice(0, 12)
          .map((direction) => direction.slice(0, 80)),
        existingCards: drafts
          .filter((draft) => draft.rulesLocked)
          .map((draft) => draft.definition),
        openSlots,
      });
      for (const proposal of response.proposals) {
        const slot = slotsById.get(proposal.slotId);
        if (
          slot === undefined ||
          proposal.proposal.id !== slot.cardId ||
          proposal.proposal.factionId !== slot.factionId ||
          proposal.proposal.rarity !== slot.rarity ||
          proposal.proposal.type !== slot.type
        ) {
          throw new Error("AI set proposal changed a fixed slot constraint");
        }
      }
      setAiProposals(response.proposals);
    } catch (cause) {
      setAiError(
        `AI assistance unavailable: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setAiLoading(false);
    }
  }

  function acceptAiProposal(proposal: SetCardProposal): void {
    if (queueCommand === undefined || projectLocked) return;
    queueCommand({
      type: "UPDATE_CARD_DRAFT",
      expansionId: project.id,
      cardId: proposal.proposal.id,
      draft: proposal.proposal,
    });
    setAiProposals((current) =>
      current.filter((candidate) => candidate.slotId !== proposal.slotId),
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="set-review-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {drafts.length} of {project.size} proposals
          </p>
          <h2 id="set-review-title" className="mt-2 text-xl font-semibold">
            Set Review
          </h2>
        </div>
        <button
          type="button"
          disabled={projectLocked || lowRisk.length === 0}
          onClick={() =>
            lowRisk.forEach((draft) => onAccept(draft.definition.id))
          }
          className="rounded border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        >
          Accept low-risk proposals
        </button>
      </div>

      {queueCommand !== undefined && (
        <section className="space-y-3 rounded border border-sky-900 bg-sky-950/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sky-200">
                Optional set completion
              </h3>
              <p className="text-sm text-slate-400">
                Generated drafts remain proposals until individually accepted.
              </p>
            </div>
            <button
              type="button"
              disabled={projectLocked || aiLoading || drafts.length === 0}
              onClick={() => void requestSetCompletion()}
              className="rounded border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-200 disabled:opacity-50"
            >
              {aiLoading
                ? "Generating set proposals..."
                : "Complete editable slots with AI"}
            </button>
          </div>
          {aiProposals.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">AI set proposals</h3>
              {aiProposals.map((proposal) => (
                <article
                  key={proposal.slotId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-700 bg-slate-950/60 p-3"
                >
                  <div>
                    <p className="font-medium">{proposal.proposal.name}</p>
                    <p className="text-xs text-slate-400">
                      {proposal.slotId} - Opinion - {proposal.risk.level} risk
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => acceptAiProposal(proposal)}
                    aria-label={`Accept AI proposal for ${proposal.proposal.name}`}
                    className="rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950"
                  >
                    Accept proposal
                  </button>
                </article>
              ))}
            </div>
          )}
          {aiError !== null && (
            <p role="alert" className="text-sm text-red-300">
              {aiError}
            </p>
          )}
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3">Card</th>
              <th className="px-3 py-3">Slot</th>
              <th className="px-3 py-3">Risk</th>
              <th className="px-3 py-3">Revision</th>
              <th className="px-3 py-3">Review actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {drafts.map((draft) => {
              const id = draft.definition.id;
              const disabled = projectLocked || draft.rulesLocked;
              const risk = classifyProposalRisk(draft);
              return (
                <tr key={id}>
                  <td className="px-3 py-3">
                    <p className="font-medium">{draft.definition.name}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {id}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {draft.slot.intendedFactionId} · {draft.slot.intendedRarity}{" "}
                    · {draft.slot.intendedCardType}
                  </td>
                  <td className="px-3 py-3">{risk}</td>
                  <td className="px-3 py-3">{draft.gameplayRevision}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["Accept", onAccept],
                          ["Edit", onEdit],
                        ] as const
                      ).map(([label, action]) => (
                        <button
                          key={label}
                          type="button"
                          disabled={disabled}
                          onClick={() => action(id)}
                          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-emerald-700 disabled:cursor-not-allowed disabled:text-slate-600"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {projectLocked && (
        <p className="text-sm text-amber-300">
          Gameplay review is locked because this expansion is{" "}
          {project.stage.toLowerCase()}.
        </p>
      )}
    </section>
  );
}
