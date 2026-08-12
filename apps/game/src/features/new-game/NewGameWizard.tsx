import { useMemo, useState, type FormEvent } from "react";
import {
  parseCardDefinition,
  type CardDefinition,
} from "../../../../../packages/domain/src/index";
import { createLaunchSetFixture } from "../../../../../packages/testkit/src/index";
import {
  createOfflineLaunch,
  type OfflineLaunchInput,
  type OfflineLaunchResult,
} from "./setup-service";

export type NewGameWizardProps = {
  onLaunch: (
    result: OfflineLaunchResult,
    input: OfflineLaunchInput,
  ) => void | Promise<void>;
};

export function NewGameWizard({ onLaunch }: NewGameWizardProps) {
  const fixture = useMemo(() => createLaunchSetFixture(), []);
  const [step, setStep] = useState<"BRAND" | "CARDS" | "PRODUCTION">("BRAND");
  const [gameName, setGameName] = useState("My Trading Card Game");
  const [setting, setSetting] = useState("Four factions compete for glory.");
  const [visualKeywords, setVisualKeywords] = useState("bold, collectible");
  const [cards, setCards] = useState<CardDefinition[]>(fixture.cards);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [cardDraft, setCardDraft] = useState(() =>
    JSON.stringify(fixture.cards[0], null, 2),
  );
  const [boosterPrintQuantity, setBoosterPrintQuantity] = useState(1_000);
  const [starterPrintQuantity, setStarterPrintQuantity] = useState(250);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  function selectCard(index: number): void {
    setSelectedCardIndex(index);
    setCardDraft(JSON.stringify(cards[index], null, 2));
    setError(null);
  }

  function applyCardEdit(): void {
    try {
      const parsed = parseCardDefinition(JSON.parse(cardDraft));
      const expectedId = cards[selectedCardIndex]?.id;
      if (parsed.id !== expectedId) {
        throw new Error("Card slot IDs cannot change during Setup");
      }
      setCards((current) =>
        current.map((card, index) =>
          index === selectedCardIndex ? parsed : card,
        ),
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function launch(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLaunching(true);
    setError(null);
    const input: OfflineLaunchInput = {
      seed: `${gameName
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")}-launch`,
      gameName,
      setting,
      visualKeywords: visualKeywords.split(","),
      boosterPrintQuantity,
      starterPrintQuantity,
      cards,
    };
    try {
      await onLaunch(createOfflineLaunch(input), input);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLaunching(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={launch}>
      <ol className="flex gap-2 text-sm text-slate-400">
        {(["BRAND", "CARDS", "PRODUCTION"] as const).map((item, index) => (
          <li key={item} className={step === item ? "text-emerald-300" : ""}>
            {index + 1}. {item.toLowerCase()}
          </li>
        ))}
      </ol>

      {step === "BRAND" && (
        <fieldset className="grid max-w-2xl gap-4">
          <legend className="mb-4 text-xl font-semibold">
            Create your TCG
          </legend>
          <label className="grid gap-1">
            <span>Name</span>
            <input
              required
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="grid gap-1">
            <span>One-sentence setting</span>
            <input
              required
              value={setting}
              onChange={(event) => setSetting(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="grid gap-1">
            <span>Visual keywords, comma separated</span>
            <input
              value={visualKeywords}
              onChange={(event) => setVisualKeywords(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => setStep("CARDS")}
            className="w-fit rounded bg-emerald-500 px-4 py-2 font-medium text-slate-950"
          >
            Review Launch cards
          </button>
        </fieldset>
      )}

      {step === "CARDS" && (
        <fieldset className="space-y-4">
          <legend className="text-xl font-semibold">
            Structured Launch Set editor
          </legend>
          <p className="text-sm text-slate-400">
            The deterministic fixture fills all 48 slots. Edit legal structured
            CardDefinition JSON directly.
          </p>
          <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
            <select
              aria-label="Launch card"
              size={12}
              value={selectedCardIndex}
              onChange={(event) => selectCard(Number(event.target.value))}
              className="rounded border border-slate-700 bg-slate-900 p-2"
            >
              {cards.map((card, index) => (
                <option key={card.id} value={index}>
                  {index + 1}. {card.name}
                </option>
              ))}
            </select>
            <textarea
              aria-label="Structured card JSON"
              value={cardDraft}
              onChange={(event) => setCardDraft(event.target.value)}
              className="min-h-80 rounded border border-slate-700 bg-slate-900 p-3 font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={applyCardEdit}
              className="rounded border border-emerald-500 px-4 py-2 text-emerald-300"
            >
              Apply structured edit
            </button>
            <button
              type="button"
              disabled
              title="Generative providers arrive in Phase 4"
              className="cursor-not-allowed rounded border border-slate-700 px-4 py-2 text-slate-500"
            >
              Generate with AI (Phase 4)
            </button>
            <button
              type="button"
              onClick={() => setStep("PRODUCTION")}
              className="rounded bg-emerald-500 px-4 py-2 font-medium text-slate-950"
            >
              Configure launch production
            </button>
          </div>
        </fieldset>
      )}

      {step === "PRODUCTION" && (
        <fieldset className="grid max-w-xl gap-4">
          <legend className="mb-4 text-xl font-semibold">
            Initial Print Runs
          </legend>
          <label className="grid gap-1">
            <span>Booster quantity</span>
            <input
              type="number"
              min={1}
              step={1}
              value={boosterPrintQuantity}
              onChange={(event) =>
                setBoosterPrintQuantity(Number(event.target.value))
              }
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="grid gap-1">
            <span>Quantity per Starter</span>
            <input
              type="number"
              min={1}
              step={1}
              value={starterPrintQuantity}
              onChange={(event) =>
                setStarterPrintQuantity(Number(event.target.value))
              }
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={launching}
            className="w-fit rounded bg-emerald-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-50"
          >
            {launching ? "Launching…" : "Launch and enter Day 1"}
          </button>
        </fieldset>
      )}

      {error !== null && <p className="text-red-300">{error}</p>}
    </form>
  );
}
