import { describe, expect, it } from "vitest";
import { buildSimilarWebSeedState } from "../../src/extensions/consents/similarweb";

describe("buildSimilarWebSeedState", () => {
  it("enables tracking instead of disabling it", () => {
    expect(buildSimilarWebSeedState().isTrackingDisabled).toBe(false);
  });
});
