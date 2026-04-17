import { describe, expect, it } from "vitest";
import {
  findExpectedText,
  matchesExpectedText,
  matchesPathIncludes,
  resolveBrowseWindow,
} from "../../src/flows/utils";

describe("flow utils", () => {
  it("findExpectedText returns the matching expected phrase case-insensitively", () => {
    expect(
      findExpectedText(
        "Learn advanced cooking with structure and flow.",
        ["learn advanced cooking", "not present"],
      ),
    ).toBe("learn advanced cooking");
  });

  it("matchesExpectedText returns false when none of the phrases are present", () => {
    expect(matchesExpectedText("Hello world", ["pricing", "credits"])).toBe(
      false,
    );
  });

  it("matchesPathIncludes accepts any configured landing fragment", () => {
    expect(
      matchesPathIncludes(
        "https://eurocookflow.com/auth/sign-in?next=%2Fapp%2Fsettings",
        ["/auth/sign-in", "/app/settings"],
      ),
    ).toBe(true);
  });

  it("resolveBrowseWindow keeps default timings without a session policy", () => {
    expect(
      resolveBrowseWindow(
        undefined,
        { minMs: 10_000, maxMs: 20_000 },
        { minMs: 2_000, maxMs: 5_000 },
      ),
    ).toEqual({ minMs: 10_000, maxMs: 20_000 });
  });

  it("resolveBrowseWindow switches to smoke timings for short smoke policies", () => {
    expect(
      resolveBrowseWindow(
        { minDurationMs: 10_000, maxTopUpCycles: 1 },
        { minMs: 10_000, maxMs: 20_000 },
        { minMs: 2_000, maxMs: 5_000 },
      ),
    ).toEqual({ minMs: 2_000, maxMs: 5_000 });
  });

  it("resolveBrowseWindow keeps default timings when only duration is short", () => {
    expect(
      resolveBrowseWindow(
        { minDurationMs: 10_000, maxTopUpCycles: 3 },
        { minMs: 10_000, maxMs: 20_000 },
        { minMs: 2_000, maxMs: 5_000 },
      ),
    ).toEqual({ minMs: 10_000, maxMs: 20_000 });
  });
});
