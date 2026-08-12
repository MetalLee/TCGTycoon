import { useEffect, useState } from "react";
import type { MatchReplay as PersistedMatchReplay } from "../../../../../packages/rules-engine/src/index";

export type MatchReplayProps = { replay: PersistedMatchReplay };
type PlaybackSpeed = 1 | 2 | 4;

function actionText(entry: PersistedMatchReplay["actionLog"][number]): string {
  switch (entry.type) {
    case "CARD_DRAWN":
      return `${entry.side} drew ${entry.cardId}`;
    case "CARD_BURNED":
      return `${entry.side} burned ${entry.cardId}`;
    case "COIN_ADDED":
      return `${entry.side} received the Coin`;
    case "FATIGUE_DAMAGE":
      return `${entry.side} took ${entry.amount} fatigue damage`;
    case "TURN_STARTED":
      return `${entry.side} started turn ${entry.turn} with ${entry.maxMana} mana`;
    case "TURN_ENDED":
      return `${entry.side} ended turn ${entry.turn}`;
    case "MULLIGAN":
      return `${entry.side} returned ${entry.returnedCardIds.length} card(s)`;
    case "PLAY_CARD":
      return `${entry.side} played ${entry.cardId}`;
    case "ATTACK":
      return `${entry.side} attacked ${entry.targetId}`;
  }
}

export function MatchReplay({ replay }: MatchReplayProps) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const atEnd = cursor >= replay.actionLog.length;

  useEffect(() => {
    if (!playing || atEnd) return;
    const timer = window.setTimeout(
      () =>
        setCursor((current) => Math.min(replay.actionLog.length, current + 1)),
      1000 / speed,
    );
    return () => window.clearTimeout(timer);
  }, [atEnd, cursor, playing, replay.actionLog.length, speed]);

  useEffect(() => {
    if (atEnd) setPlaying(false);
  }, [atEnd]);

  const visible = replay.actionLog.slice(0, cursor);
  const current = visible.at(-1);

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-wider text-slate-400">
          Persisted Action Log
        </p>
        <p className="mt-2 text-sm">
          Rule {replay.ruleVersion} · Battle AI {replay.battleAiVersion} · Seed{" "}
          {replay.seed}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
          <div
            className={`rounded border p-4 ${current?.side === "A" ? "border-emerald-400" : "border-slate-700"}`}
          >
            Side A · {replay.deckA.name}
          </div>
          <div
            className={`rounded border p-4 ${current?.side === "B" ? "border-emerald-400" : "border-slate-700"}`}
          >
            Side B · {replay.deckB.name}
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Replay controls"
      >
        <button
          type="button"
          className="rounded border border-slate-700 px-3 py-2"
          onClick={() => setPlaying((value) => !value)}
          disabled={atEnd}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-3 py-2"
          onClick={() =>
            setCursor((value) => Math.min(replay.actionLog.length, value + 1))
          }
          disabled={atEnd}
        >
          Step
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-3 py-2"
          onClick={() => {
            setCursor(0);
            setPlaying(false);
          }}
        >
          Restart
        </button>
        {([1, 2, 4] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={speed === value}
            className={`rounded px-3 py-2 ${speed === value ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400"}`}
            onClick={() => setSpeed(value)}
          >
            {value}x
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-400">
          {cursor}/{replay.actionLog.length} actions
        </span>
      </div>

      <ol
        className="max-h-96 space-y-2 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4"
        aria-label="Action timeline"
      >
        {visible.length === 0 ? (
          <li className="text-sm text-slate-400">
            Press Play or Step to inspect the persisted log.
          </li>
        ) : (
          visible.map((entry) => (
            <li
              key={entry.sequence}
              className="rounded border border-slate-800 p-2 text-sm"
            >
              <span className="mr-2 text-slate-500">#{entry.sequence}</span>
              {actionText(entry)}
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
