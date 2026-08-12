import { useState } from "react";
import {
  ANNOUNCEMENT_TOPICS,
  type AnnouncementTopic,
  type CommitmentType,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";

export type OfficialAnnouncementDialogProps = {
  queueCommand: (command: PublisherCommand) => void;
  currentDay: number;
  onClose?: () => void;
};

export function OfficialAnnouncementDialog({
  queueCommand,
  currentDay,
  onClose,
}: OfficialAnnouncementDialogProps) {
  const [topic, setTopic] = useState<AnnouncementTopic>("DEVELOPMENT");
  const [text, setText] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [commitmentType, setCommitmentType] = useState<CommitmentType | "">("");
  const [commitmentDueDay, setCommitmentDueDay] = useState(currentDay + 1);
  return (
    <section
      role="dialog"
      aria-labelledby="announcement-title"
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5"
    >
      <h2 id="announcement-title" className="text-xl font-semibold">
        Official announcement
      </h2>
      <label className="block text-sm">
        Topic
        <select
          aria-label="Topic"
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={topic}
          onChange={(event) =>
            setTopic(event.target.value as AnnouncementTopic)
          }
        >
          {ANNOUNCEMENT_TOPICS.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Structured commitment
        <select
          aria-label="Structured commitment"
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={commitmentType}
          onChange={(event) =>
            setCommitmentType(event.target.value as CommitmentType | "")
          }
        >
          <option value="">No commitment</option>
          <option value="RELEASE_PRODUCT">Release product</option>
          <option value="COMPLETE_REPRINT">Complete reprint</option>
          <option value="ENACT_POLICY">Enact policy</option>
          <option value="RUN_TOURNAMENT">Run tournament</option>
          <option value="FINALIZE_EXPANSION">Finalize expansion</option>
        </select>
      </label>
      {commitmentType !== "" && (
        <label className="block text-sm">
          Commitment due day
          <input
            aria-label="Commitment due day"
            type="number"
            min={currentDay}
            value={commitmentDueDay}
            onChange={(event) =>
              setCommitmentDueDay(Number(event.target.value))
            }
            className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
      )}
      <label className="block text-sm">
        Subject ID (optional)
        <input
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        Announcement text
        <textarea
          className="mt-1 block min-h-28 w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        {onClose && (
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={
            text.trim().length === 0 ||
            (commitmentType !== "" &&
              (subjectId.trim().length === 0 ||
                !Number.isInteger(commitmentDueDay) ||
                commitmentDueDay < currentDay))
          }
          className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40"
          onClick={() => {
            queueCommand({
              type: "PUBLISH_ANNOUNCEMENT",
              topic,
              text: text.trim(),
              ...(subjectId.trim() ? { subjectId: subjectId.trim() } : {}),
              ...(commitmentType === "" || subjectId.trim().length === 0
                ? {}
                : {
                    commitment: {
                      type: commitmentType,
                      subjectId: subjectId.trim(),
                      dueDay: commitmentDueDay,
                    },
                  }),
            });
            onClose?.();
          }}
        >
          Queue announcement
        </button>
      </div>
    </section>
  );
}
