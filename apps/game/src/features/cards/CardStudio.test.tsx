// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  expansionId,
  factionId,
  operationId,
  type CardDefinition,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";
import { createExpansion } from "../../../../../packages/sim-core/src/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardStudio } from "./CardStudio";

const card: CardDefinition = {
  id: "card-studio-unit" as CardDefinition["id"],
  name: "Studio Unit",
  type: "UNIT",
  factionId: factionId("fire"),
  rarity: "COMMON",
  cost: 2,
  attack: 2,
  health: 3,
  keywords: [],
  triggers: [],
};

function createDraft() {
  const project = createExpansion({
    id: expansionId("set-studio"),
    operationId: operationId("operation-set-studio"),
    name: "Studio Set",
    size: 24,
    createdDay: 4,
    brief: {
      theme: "Studio fixture",
      focusFactionIds: [factionId("fire")],
      strategicDirections: ["Unit combat"],
      productPositioning: "Test",
    },
    cards: [card],
  });
  return project.cardDrafts[card.id]!;
}

afterEach(cleanup);

describe("CardStudio", () => {
  it("queues an UPDATE_CARD_DRAFT for cost/effect edits without mutating its draft", () => {
    const draft = createDraft();
    const before = structuredClone(draft);
    const queued: PublisherCommand[] = [];
    const triggers = [
      {
        trigger: "ON_PLAY",
        conditions: [],
        effects: [{ type: "DEAL_DAMAGE", amount: 1, target: "ENEMY_HERO" }],
      },
    ];

    render(
      <CardStudio
        expansionId={expansionId("set-studio")}
        draft={draft}
        queueCommand={(command) => queued.push(command)}
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Cost" }), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Effects JSON" }), {
      target: { value: JSON.stringify(triggers) },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Queue gameplay edit" }),
    );

    expect(queued).toEqual([
      {
        type: "UPDATE_CARD_DRAFT",
        expansionId: expansionId("set-studio"),
        cardId: card.id,
        draft: { ...card, cost: 4, triggers },
      },
    ]);
    expect(draft).toEqual(before);
  });

  it("disables the gameplay editor when rules are locked", () => {
    const draft = createDraft();
    draft.rulesLocked = true;
    const queueCommand = vi.fn();

    render(
      <CardStudio
        expansionId={expansionId("set-studio")}
        draft={draft}
        queueCommand={queueCommand}
      />,
    );

    expect(
      (screen.getByRole("spinbutton", { name: "Cost" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("textbox", {
          name: "Effects JSON",
        }) as HTMLTextAreaElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Gameplay rules locked",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(queueCommand).not.toHaveBeenCalled();
  });
});
