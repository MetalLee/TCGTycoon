// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  cardId,
  expansionId,
  factionId,
  operationId,
  type CardDefinition,
} from "../../../../../packages/domain/src/index";
import { createExpansion } from "../../../../../packages/sim-core/src/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetReview } from "./SetReview";

function unit(
  id: string,
  name: string,
  triggers: CardDefinition["triggers"] = [],
): CardDefinition {
  return {
    id: cardId(id),
    name,
    type: "UNIT",
    factionId: factionId("fire"),
    rarity: "COMMON",
    cost: 2,
    attack: 2,
    health: 3,
    keywords: [],
    triggers,
  };
}

function createProject() {
  return createExpansion({
    id: expansionId("set-review"),
    operationId: operationId("operation-set-review"),
    name: "Review Set",
    size: 24,
    createdDay: 4,
    brief: {
      theme: "Review fixture",
      focusFactionIds: [factionId("fire")],
      strategicDirections: ["Unit combat"],
      productPositioning: "Test",
    },
    cards: [
      unit("card-low-risk", "Low Risk Unit"),
      unit("card-review", "Review Unit", [
        {
          trigger: "ON_PLAY",
          conditions: [],
          effects: [{ type: "DEAL_DAMAGE", amount: 1, target: "ENEMY_HERO" }],
        },
      ]),
    ],
  });
}

afterEach(cleanup);

describe("SetReview", () => {
  it("bulk accepts only legal low-risk proposals and opens structured editing", () => {
    const project = createProject();
    const before = structuredClone(project);
    const onAccept = vi.fn();
    const onEdit = vi.fn();

    render(<SetReview project={project} onAccept={onAccept} onEdit={onEdit} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Accept low-risk proposals" }),
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith(cardId("card-low-risk"));

    const reviewRow = screen.getByRole("row", { name: /Review Unit/ });
    fireEvent.click(within(reviewRow).getByRole("button", { name: "Accept" }));
    fireEvent.click(within(reviewRow).getByRole("button", { name: "Edit" }));

    expect(onAccept).toHaveBeenLastCalledWith(cardId("card-review"));
    expect(onEdit).toHaveBeenCalledWith(cardId("card-review"));
    expect(project).toEqual(before);
  });
});
