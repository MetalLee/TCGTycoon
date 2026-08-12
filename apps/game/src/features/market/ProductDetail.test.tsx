// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  productId,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";
import { ProductDetail } from "./ProductDetail";

afterEach(cleanup);

describe("ProductDetail", () => {
  it("queues a validated MSRP change instead of a no-op review", () => {
    const queued: PublisherCommand[] = [];
    render(
      <ProductDetail
        view={{
          id: productId("product-msrp-test"),
          name: "MSRP Test Booster",
          kind: "BOOSTER",
          status: "LIVE",
          msrp: 4.99,
          inventory: 100,
          salesRevenue: 0,
          packExpectedValue: 2.5,
        }}
        queueCommand={(command) => queued.push(command)}
      />,
    );

    const input = screen.getByLabelText("New MSRP");
    fireEvent.change(input, { target: { value: "5.49" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue MSRP change" }));

    expect(queued).toEqual([
      {
        type: "ADJUST_MSRP",
        productId: productId("product-msrp-test"),
        newMsrp: 5.49,
      },
    ]);
  });

  it("does not enable an unchanged or invalid MSRP", () => {
    render(
      <ProductDetail
        view={{
          id: productId("product-msrp-validation"),
          name: "Validation Booster",
          kind: "BOOSTER",
          status: "LIVE",
          msrp: 4.99,
          inventory: 100,
          salesRevenue: 0,
          packExpectedValue: 2.5,
        }}
        queueCommand={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Queue MSRP change" });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("New MSRP"), {
      target: { value: "-1" },
    });
    expect(button).toHaveProperty("disabled", true);
  });
});
