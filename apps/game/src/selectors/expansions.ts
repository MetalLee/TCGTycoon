import type {
  ExpansionId,
  ProductReleaseStatus,
  WorldState,
} from "../../../../packages/domain/src/index";
import type {
  ExpansionPipelineProject,
  ExpansionStage,
} from "../../../../packages/sim-core/src/index";
import type { DeepReadonly } from "../app/game-session/GameSessionController";

export type ExpansionSummary = Readonly<{
  id: ExpansionId;
  name: string;
  cardCount: number;
  stage: ExpansionStage;
  designProgressDays: number;
  designTargetDays: number | null;
  productStatuses: readonly ProductReleaseStatus[];
}>;

type ExpansionsWorld = DeepReadonly<WorldState>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function inferredStage(
  world: ExpansionsWorld,
  expansionId: ExpansionId,
): ExpansionStage {
  const project = world.expansionProjects?.[expansionId];
  const products = Object.values(world.products).filter(
    (product) => product.expansionId === expansionId,
  );
  if (products.some((product) => product.releaseStatus === "LIVE")) {
    return "RELEASED";
  }
  if (project !== undefined) return project.stage;
  if (
    Object.values(world.printRuns).some(
      (run) => run.sourceExpansionId === expansionId,
    )
  ) {
    return "PRINTING";
  }
  const operations = Object.values(world.operations ?? {}).filter(
    (operation) =>
      (operation.type === "EXPANSION_DESIGN" ||
        operation.type === "PLAYTEST") &&
      operation.payload.expansionId === expansionId &&
      operation.status !== "CANCELLED" &&
      operation.status !== "FAILED",
  );
  if (operations.some((operation) => operation.type === "PLAYTEST")) {
    return "PLAYTEST";
  }
  if (operations.some((operation) => operation.type === "EXPANSION_DESIGN")) {
    return "DESIGN";
  }
  return "CONCEPT";
}

export function selectExpansions(world: ExpansionsWorld): ExpansionSummary[] {
  return Object.values(world.expansions)
    .map((expansion) => {
      const designOperation = Object.values(world.operations ?? {})
        .filter(
          (operation) =>
            operation.type === "EXPANSION_DESIGN" &&
            operation.payload.expansionId === expansion.id,
        )
        .sort((left, right) => compareText(left.id, right.id))
        .at(-1);
      const products = Object.values(world.products).filter(
        (product) => product.expansionId === expansion.id,
      );
      const project = world.expansionProjects?.[expansion.id];
      return {
        id: expansion.id,
        name: expansion.name,
        cardCount:
          project === undefined
            ? Object.values(world.cards).filter((card) =>
                Object.values(world.printings).some(
                  (printing) =>
                    printing.cardId === card.id &&
                    printing.expansionId === expansion.id,
                ),
              ).length
            : Object.keys(project.cardDrafts).length,
        stage: inferredStage(world, expansion.id),
        designProgressDays:
          project?.designProgressDays ?? designOperation?.progressDays ?? 0,
        designTargetDays:
          project?.designTargetDays ??
          (designOperation?.completionDay === undefined
            ? null
            : designOperation.completionDay - designOperation.createdDay + 1),
        productStatuses: products
          .map((product) => product.releaseStatus)
          .sort(compareText),
      };
    })
    .sort((left, right) => compareText(left.name, right.name));
}

export function selectExpansionProjectView(
  project: Readonly<ExpansionPipelineProject>,
): ExpansionSummary {
  return {
    id: project.id,
    name: project.name,
    cardCount: Object.keys(project.cardDrafts).length,
    stage: project.stage,
    designProgressDays: project.designProgressDays,
    designTargetDays: project.designTargetDays,
    productStatuses: [],
  };
}
