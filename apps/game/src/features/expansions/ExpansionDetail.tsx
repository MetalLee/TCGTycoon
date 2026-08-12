import type {
  ExpansionId,
  PublisherCommand,
} from "../../../../../packages/domain/src/index";
import type { ExpansionPipelineProject } from "../../../../../packages/sim-core/src/index";
import { SetReview } from "./SetReview";

export type ExpansionDetailProps = {
  project: Readonly<ExpansionPipelineProject>;
  queueCommand: (command: PublisherCommand) => void;
  onAcceptCard: (cardId: Parameters<SetReviewProps["onAccept"]>[0]) => void;
  onEditCard: (cardId: Parameters<SetReviewProps["onEdit"]>[0]) => void;
  onDeleteCard: (cardId: Parameters<SetReviewProps["onDelete"]>[0]) => void;
  onRegenerateCard: (
    cardId: Parameters<SetReviewProps["onRegenerate"]>[0],
  ) => void;
  onManualReplaceCard: (
    cardId: Parameters<SetReviewProps["onManualReplace"]>[0],
  ) => void;
};

type SetReviewProps = React.ComponentProps<typeof SetReview>;

function queueFinalize(
  queueCommand: ExpansionDetailProps["queueCommand"],
  expansionId: ExpansionId,
): void {
  queueCommand({ type: "FINALIZE_EXPANSION", expansionId });
}

export function ExpansionDetail({
  project,
  queueCommand,
  onAcceptCard,
  onEditCard,
  onDeleteCard,
  onRegenerateCard,
  onManualReplaceCard,
}: ExpansionDetailProps) {
  const finalized =
    project.stage === "FINALIZED" ||
    project.stage === "PRINTING" ||
    project.stage === "RELEASED";
  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {project.stage}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{project.name}</h2>
          <p className="mt-2 text-sm text-slate-400">
            Design {project.designProgressDays}/{project.designTargetDays} days
            · {project.size} slots
          </p>
        </div>
        <button
          type="button"
          disabled={finalized}
          onClick={() => queueFinalize(queueCommand, project.id)}
          className="rounded border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        >
          {finalized ? "Gameplay finalized" : "Queue irreversible Finalize"}
        </button>
      </header>
      {project.riskWarnings.length > 0 && (
        <section className="rounded border border-amber-900 bg-amber-950/20 p-4">
          <h3 className="font-semibold text-amber-200">Unresolved risks</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-100">
            {project.riskWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
      <SetReview
        project={project}
        onAccept={onAcceptCard}
        onEdit={onEditCard}
        onDelete={onDeleteCard}
        onRegenerate={onRegenerateCard}
        onManualReplace={onManualReplaceCard}
      />
    </article>
  );
}
