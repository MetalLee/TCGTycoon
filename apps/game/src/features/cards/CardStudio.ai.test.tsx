// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  cardProposalResponseSchema,
  setCompletionResponseSchema,
  worldAssistResponseSchema,
  type CardProposalResponse,
  type SetCompletionResponse,
} from "../../../../../packages/ai-contracts/src/index";
import {
  cardId,
  expansionId,
  factionId,
  operationId,
  type CardDefinition,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";
import { createExpansion } from "../../../../../packages/sim-core/src/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiClient } from "../../services/ai/ai-client";
import { CardStudio } from "./CardStudio";
import { NewGameWizard } from "../new-game/NewGameWizard";
import { SetReview } from "../expansions/SetReview";

const card: CardDefinition = {
  id: cardId("card-ai-studio"),
  name: "Studio Unit",
  type: "UNIT",
  factionId: factionId("machine"),
  rarity: "COMMON",
  cost: 2,
  attack: 2,
  health: 3,
  keywords: [],
  triggers: [],
};

const cardProposal: CardProposalResponse = cardProposalResponseSchema.parse({
  proposal: {
    ...card,
    name: "Scrap Sentinel",
    cost: 3,
    attack: 2,
    health: 4,
    keywords: ["TAUNT"],
  },
  displayText: "Taunt",
  risk: {
    level: "LOW",
    categories: ["STATS_EFFICIENCY"],
    explanation: "A defensive baseline unit.",
  },
  translationNotes: [],
});

function createProject() {
  return createExpansion({
    id: expansionId("set-ai-studio"),
    operationId: operationId("operation-ai-studio"),
    name: "AI Studio Set",
    size: 24,
    createdDay: 4,
    brief: {
      theme: "Industrial fantasy",
      focusFactionIds: [factionId("machine")],
      strategicDirections: ["Defensive units"],
      productPositioning: "Booster expansion",
    },
    cards: [card],
  });
}

function createAiClient(overrides: Partial<AiClient> = {}): AiClient {
  return {
    assistWorld: vi.fn(async () =>
      worldAssistResponseSchema.parse({
        settingSummary: "Four city-states bind awakened relic machines.",
        factions: ["forge", "tide", "grove", "archive"].map((id) => ({
          id,
          name: `${id} faction`,
          concept: `${id} concept`,
          visualKeywords: [id],
        })),
      }),
    ),
    proposeCard: vi.fn(async () => cardProposal),
    completeSet: vi.fn(async () =>
      setCompletionResponseSchema.parse({
        proposals: [{ slotId: "slot-0", ...cardProposal }],
      }),
    ),
    ...overrides,
  };
}

afterEach(cleanup);

describe("optional AI creation assistance", () => {
  it("previews a legal Card Studio proposal and queues it only after acceptance", async () => {
    const project = createProject();
    const draft = project.cardDrafts[card.id]!;
    const before = structuredClone(draft);
    const queued: PublisherCommand[] = [];

    render(
      <CardStudio
        expansionId={project.id}
        draft={draft}
        queueCommand={(command) => queued.push(command)}
        aiClient={createAiClient()}
        setTheme={project.brief.theme}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Design intent" }), {
      target: { value: "A sturdy salvage guardian" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Generate AI proposal" }),
    );

    expect(await screen.findByText("AI proposal preview")).toBeTruthy();
    expect(screen.getByText("Scrap Sentinel")).toBeTruthy();
    expect(screen.getByText(/"TAUNT"/)).toBeTruthy();
    expect(queued).toEqual([]);
    expect(draft).toEqual(before);

    fireEvent.click(screen.getByRole("button", { name: "Accept AI proposal" }));

    expect(queued).toEqual([
      {
        type: "UPDATE_CARD_DRAFT",
        expansionId: project.id,
        cardId: card.id,
        draft: cardProposal.proposal,
      },
    ]);
    expect(draft).toEqual(before);
  });

  it("keeps the structured Card Studio editor usable when AI rejects", async () => {
    const project = createProject();
    const queued: PublisherCommand[] = [];
    const aiClient = createAiClient({
      proposeCard: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    render(
      <CardStudio
        expansionId={project.id}
        draft={project.cardDrafts[card.id]!}
        queueCommand={(command) => queued.push(command)}
        aiClient={aiClient}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Design intent" }), {
      target: { value: "Try an optional proposal" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Generate AI proposal" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "AI assistance unavailable",
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Cost" }), {
      target: { value: "4" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Queue gameplay edit" }),
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ type: "UPDATE_CARD_DRAFT" });
  });

  it("keeps offline New Game launch usable when world assistance rejects", async () => {
    const onLaunch = vi.fn();
    const aiClient = createAiClient({
      assistWorld: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    render(<NewGameWizard onLaunch={onLaunch} aiClient={aiClient} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Suggest factions with AI" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "AI assistance unavailable",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Launch cards" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Configure launch production" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Launch and enter Day 1" }),
    );

    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1));
  });

  it("previews four New Game faction concepts until the player accepts them", async () => {
    render(<NewGameWizard onLaunch={vi.fn()} aiClient={createAiClient()} />);
    const setting = screen.getByRole("textbox", {
      name: "One-sentence setting",
    }) as HTMLInputElement;
    const originalSetting = setting.value;

    fireEvent.click(
      screen.getByRole("button", { name: "Suggest factions with AI" }),
    );

    expect(await screen.findByText("AI world suggestion")).toBeTruthy();
    for (const name of [
      "forge faction",
      "tide faction",
      "grove faction",
      "archive faction",
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(setting.value).toBe(originalSetting);

    fireEvent.click(
      screen.getByRole("button", { name: "Accept AI world suggestion" }),
    );
    expect(setting.value).toBe(
      "Four city-states bind awakened relic machines.",
    );
  });

  it("queues a set-completion proposal only after individual acceptance", async () => {
    const project = createProject();
    const before = structuredClone(project);
    const queued: PublisherCommand[] = [];
    const response: SetCompletionResponse = setCompletionResponseSchema.parse({
      proposals: [{ slotId: "slot-0", ...cardProposal }],
    });

    render(
      <SetReview
        project={project}
        onAccept={vi.fn()}
        onEdit={vi.fn()}
        queueCommand={(command) => queued.push(command)}
        aiClient={createAiClient({ completeSet: vi.fn(async () => response) })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Complete editable slots with AI" }),
    );
    expect(await screen.findByText("AI set proposals")).toBeTruthy();
    expect(queued).toEqual([]);
    expect(project).toEqual(before);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Accept AI proposal for Scrap Sentinel",
      }),
    );
    expect(queued).toEqual([
      {
        type: "UPDATE_CARD_DRAFT",
        expansionId: project.id,
        cardId: card.id,
        draft: cardProposal.proposal,
      },
    ]);
    expect(project).toEqual(before);
  });

  it("keeps manual Set Review controls usable when completion rejects", async () => {
    const project = createProject();
    const onEdit = vi.fn();
    const queueCommand = vi.fn();
    render(
      <SetReview
        project={project}
        onAccept={vi.fn()}
        onEdit={onEdit}
        queueCommand={queueCommand}
        aiClient={createAiClient({
          completeSet: vi.fn(async () => {
            throw new Error("offline");
          }),
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Complete editable slots with AI" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "AI assistance unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith(card.id);
    expect(queueCommand).not.toHaveBeenCalled();
  });
});
