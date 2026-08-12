// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  expansionId,
  operationId,
  printRunId,
  tournamentId,
} from "../../../../../packages/domain/src/index";
import { createTestWorld } from "../../../../../packages/testkit/src/index";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EndDayDialog } from "./EndDayDialog";

afterEach(cleanup);

describe("EndDayDialog", () => {
  it("reviews important warnings and always allows an idle session to proceed", () => {
    const world = createTestWorld("end-day-review");
    const product = world.products["product-launch-booster"]!;
    world.day = 12;
    world.status = "LIVE";
    world.metrics.metaHealth = 0;
    product.releaseStatus = "LIVE";
    product.releasedDay = 1;
    world.printRuns["print-run-empty"] = {
      id: printRunId("print-run-empty"),
      productId: product.id,
      sourceExpansionId: product.expansionId,
      productKind: product.kind,
      cardIds: product.cardIds,
      orderedQuantity: 10,
      quantity: 0,
      orderedDay: 1,
      completionDay: 2,
      unitCost: 1,
      totalCost: 10,
      status: "COMPLETED",
      printingIds: [],
    };
    world.operations = {
      "operation-playtest": {
        id: operationId("operation-playtest"),
        type: "PLAYTEST",
        createdDay: 9,
        startDay: 9,
        completionDay: 12,
        status: "COMPLETED",
        progressDays: 3,
        payload: {
          expansionId: expansionId("set-launch"),
          tier: "STANDARD",
        },
      },
      "operation-tournament": {
        id: operationId("operation-tournament"),
        type: "TOURNAMENT",
        createdDay: 10,
        startDay: 13,
        completionDay: 13,
        status: "PLANNED",
        progressDays: 0,
        payload: { tournamentId: tournamentId("tournament-regional") },
      },
    };
    const onProceed = vi.fn();

    render(
      <EndDayDialog
        world={world}
        sessionStatus="IDLE"
        pendingCommandCount={2}
        onProceed={onProceed}
      />,
    );

    expect(screen.getByText(/launch booster is out of stock/i)).toBeDefined();
    expect(screen.getByText(/meta health is critical/i)).toBeDefined();
    expect(
      screen.getByText(/standard playtest completed today/i),
    ).toBeDefined();
    expect(
      screen.getByText(/tournament-regional starts tomorrow/i),
    ).toBeDefined();
    expect(screen.getByText(/2 queued publisher actions/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Proceed Anyway" }));
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it("does not offer Proceed Anyway while simulation is running", () => {
    render(
      <EndDayDialog
        world={createTestWorld("end-day-running")}
        sessionStatus="SIMULATING"
        pendingCommandCount={0}
        onProceed={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Proceed Anyway" })).toBeNull();
    expect(screen.getByText(/simulation is running/i)).toBeDefined();
  });

  it("keeps Proceed Anyway visible while the completed day is saving", () => {
    render(
      <EndDayDialog
        world={createTestWorld("end-day-saving")}
        sessionStatus="SAVING"
        pendingCommandCount={0}
        onProceed={vi.fn()}
      />,
    );

    const proceed = screen.getByRole("button", { name: "Proceed Anyway" });
    expect(proceed).toBeDefined();
    expect((proceed as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/completed day is being saved/i)).toBeDefined();
  });
});
