import { describe, expect, it } from "vitest";
import { shouldCaptureRequest } from "../../src/observability/networkDebug";

describe("shouldCaptureRequest", () => {
  it("captures known SimilarWeb reporting endpoints", () => {
    expect(shouldCaptureRequest("https://data.similarweb.com/ping")).toBe(true);
  });

  it("does not capture unrelated requests", () => {
    expect(shouldCaptureRequest("https://example.com/page")).toBe(false);
  });
});
