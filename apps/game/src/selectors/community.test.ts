import { describe, expect, it } from "vitest";
import { createBalancedWorld } from "../../../../packages/testkit/src/index";
import { selectCommunityPosts } from "./community";

describe("selectCommunityPosts", () => {
  it("derives a linked supply complaint from low live product inventory", () => {
    const { world } = createBalancedWorld("community-low-inventory");
    for (const run of Object.values(world.printRuns)) run.quantity = 0;

    const complaint = selectCommunityPosts(world).find((post) =>
      post.templateText.includes("hard to find at a reasonable price"),
    );

    expect(complaint).toMatchObject({ category: "COLLECTORS" });
    expect(complaint?.links.map((link) => link.kind)).toEqual([
      "CARD",
      "PRODUCT",
    ]);
  });
});
