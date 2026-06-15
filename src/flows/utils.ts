import type { Page } from "playwright";

export interface BrowseWindow {
  minMs: number;
  maxMs: number;
}

export interface BrowseWindowPolicy {
  minDurationMs?: number;
  maxTopUpCycles?: number;
}

export function findExpectedText(
  text: string,
  expectedPhrases: string[],
): string | undefined {
  const normalized = text.toLowerCase();
  return expectedPhrases.find((phrase) =>
    normalized.includes(phrase.toLowerCase()),
  );
}

export function matchesExpectedText(
  text: string,
  expectedPhrases: string[],
): boolean {
  if (expectedPhrases.length === 0) return true;
  return Boolean(findExpectedText(text, expectedPhrases));
}

export function matchesPathIncludes(
  url: string,
  expectedFragments: string[],
): boolean {
  return expectedFragments.some((fragment) => url.includes(fragment));
}

export function resolveBrowseWindow(
  policy: BrowseWindowPolicy | undefined,
  defaults: BrowseWindow,
  smoke: BrowseWindow,
): BrowseWindow {
  if (!policy) {
    return defaults;
  }

  const minDurationMs = policy.minDurationMs ?? Number.POSITIVE_INFINITY;
  const maxTopUpCycles = policy.maxTopUpCycles ?? Number.POSITIVE_INFINITY;
  const isSmokeWindow = minDurationMs <= 30_000 && maxTopUpCycles <= 1;

  return isSmokeWindow ? smoke : defaults;
}

export async function readBodyText(page: Page): Promise<string> {
  return (await page.locator("body").textContent().catch(() => ""))?.trim() ?? "";
}

export async function waitForHydratedContent(
  page: Page,
  input: {
    selectors?: string[];
    expectedText?: string[];
    timeoutMs?: number;
  },
): Promise<void> {
  const selectors = input.selectors ?? [];
  const expectedText = input.expectedText ?? [];
  const timeoutMs = input.timeoutMs ?? 30_000;

  await page.waitForFunction(
    ({ selectors, expectedText }) => {
      const root = document.querySelector("#root");
      const hasHydratedRoot = Boolean(root && root.childElementCount > 0);
      const bodyText = (document.body?.innerText ?? "").toLowerCase();

      const hasVisibleSelector = selectors.some((selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = (el as HTMLElement).getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      });

      const hasExpectedText =
        expectedText.length === 0 ||
        expectedText.some((phrase) => bodyText.includes(phrase.toLowerCase()));

      return hasVisibleSelector || (hasHydratedRoot && hasExpectedText);
    },
    { selectors, expectedText },
    { timeout: timeoutMs },
  );
}
