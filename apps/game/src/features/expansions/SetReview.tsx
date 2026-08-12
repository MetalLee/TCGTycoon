import type { CardId } from "../../../../../packages/domain/src/index";
import type {
  ExpansionCardDraft,
  ExpansionPipelineProject,
} from "../../../../../packages/sim-core/src/index";
import { validateCardDefinition } from "../../../../../packages/rules-engine/src/index";

export type ProposalRisk = "LOW" | "REVIEW" | "INVALID";

export type SetReviewProps = {
  project: Readonly<ExpansionPipelineProject>;
  onAccept: (cardId: CardId) => void;
  onEdit: (cardId: CardId) => void;
  onDelete: (cardId: CardId) => void;
  onRegenerate: (cardId: CardId) => void;
  onManualReplace: (cardId: CardId) => void;
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
  onDelete,
  onRegenerate,
  onManualReplace,
}: SetReviewProps) {
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
                          ["Delete", onDelete],
                          ["Regenerate", onRegenerate],
                          ["Manual replacement", onManualReplace],
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
