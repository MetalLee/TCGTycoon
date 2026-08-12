import { useState } from "react";
import { useOutletContext } from "react-router";
import {
  cardId,
  type PublisherCommand,
} from "../../../../packages/domain/src/index";
import type { GameSessionSnapshot } from "../app/game-session/GameSessionController";
import { CampaignDialog } from "../features/operations/CampaignDialog";
import { OperationsCalendar } from "../features/operations/OperationsCalendar";
import { PoliciesView } from "../features/operations/PoliciesView";
import { PolicyDialog } from "../features/operations/PolicyDialog";
import { selectOperationsView } from "../features/operations/operations-model";
import { selectPolicyCardContext } from "../selectors/meta";

type Outlet = GameSessionSnapshot & {
  queueCommand?: (command: PublisherCommand) => void;
};

export function OperationsPage() {
  const outlet = useOutletContext<Outlet>();
  const [policyCardId, setPolicyCardId] = useState("");
  if (outlet.world === null)
    return (
      <section className="space-y-8">
        <h1 className="text-3xl font-semibold">Operations</h1>
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          Load a save to inspect operations.
        </p>
      </section>
    );
  const view = selectOperationsView(outlet.world as never);
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Operations</h1>
        <p className="mt-2 text-slate-400">
          Calendar, active projects, campaigns, Banlist, and Standard Rotation.
        </p>
      </header>
      <OperationsCalendar currentDay={outlet.world.day} items={view.calendar} />
      {outlet.queueCommand && (
        <CampaignDialog
          currentDay={outlet.world.day}
          queueCommand={outlet.queueCommand}
        />
      )}
      <PoliciesView policies={view.policies} />
      {outlet.queueCommand && (
        <section className="space-y-4 rounded-xl border border-slate-800 p-5">
          <h2 className="font-semibold">Policy review</h2>
          <label className="block text-sm">
            Card
            <select
              aria-label="Policy card"
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
              value={policyCardId}
              onChange={(event) => setPolicyCardId(event.target.value)}
            >
              <option value="">Choose a card</option>
              {Object.values(outlet.world.cards)
                .sort((left, right) =>
                  left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
                )
                .map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
            </select>
          </label>
          {policyCardId && (
            <PolicyDialog
              context={selectPolicyCardContext(
                outlet.world as never,
                cardId(policyCardId),
              )}
              queueCommand={outlet.queueCommand}
            />
          )}
        </section>
      )}
      <section className="rounded-xl border border-slate-800 p-5">
        <h2 className="font-semibold">Projects</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {view.projects.map((project) => (
            <li key={project.id}>
              {project.type.replaceAll("_", " ")} · {project.status}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
