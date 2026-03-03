import { z } from "zod";
import { chromium, Page } from "playwright";
import type { RpaAction, RpaResult } from "../types";

// ── Zod schemas ──────────────────────────────────────────────────────

const RpaStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("navigate"), url: z.string().url() }),
  z.object({ action: z.literal("click"), selector: z.string() }),
  z.object({
    action: z.literal("fill"),
    selector: z.string(),
    value: z.string(),
  }),
  z.object({
    action: z.literal("wait"),
    selector: z.string(),
    timeout: z.number().optional().default(10_000),
  }),
  z.object({
    action: z.literal("scroll"),
    times: z.number().optional().default(1),
  }),
  z.object({
    action: z.literal("scrape"),
    selector: z.string(),
    as: z.string(),
  }),
  z.object({
    action: z.literal("evaluate"),
    script: z.string(),
    as: z.string().optional(),
  }),
]);

export const RunRpaFlowSchema = {
  wsEndpoint: z
    .string()
    .describe(
      "WebSocket debugger URL from connectBrowser — the already-running browser to automate",
    ),
  steps: z
    .array(RpaStepSchema)
    .min(1)
    .describe("Ordered list of automation steps to execute"),
};

// ── Step executor ─────────────────────────────────────────────────────

async function executeStep(
  page: Page,
  step: RpaAction,
  collected: Record<string, unknown>,
): Promise<void> {
  switch (step.action) {
    case "navigate":
      await page.goto(step.url, { waitUntil: "networkidle", timeout: 30_000 });
      break;

    case "click":
      await page.waitForSelector(step.selector, {
        state: "visible",
        timeout: 10_000,
      });
      await page.click(step.selector);
      break;

    case "fill":
      await page.waitForSelector(step.selector, {
        state: "visible",
        timeout: 10_000,
      });
      await page.fill(step.selector, step.value);
      break;

    case "wait":
      await page.waitForSelector(step.selector, {
        state: "visible",
        timeout: (step as { timeout?: number }).timeout ?? 10_000,
      });
      break;

    case "scroll": {
      const times = (step as { times?: number }).times ?? 1;
      for (let i = 0; i < times; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(400);
      }
      break;
    }

    case "scrape": {
      const text = await page.textContent(step.selector).catch(() => null);
      collected[step.as] = text?.trim() ?? null;
      break;
    }

    case "evaluate": {
      const val = await page.evaluate(
        new Function(
          `return (async () => { ${step.script} })()`,
        ) as () => unknown,
      );
      if ((step as { as?: string }).as) {
        collected[(step as { as?: string }).as!] = val;
      }
      break;
    }
  }
}

// ── Main handler ──────────────────────────────────────────────────────

export async function runRpaFlow(
  wsEndpoint: string,
  steps: RpaAction[],
): Promise<RpaResult> {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  const collected: Record<string, unknown> = {};

  try {
    const ctx = browser.contexts()[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());

    for (const step of steps) {
      await executeStep(page, step, collected);
    }

    return { success: true, data: collected };
  } catch (err) {
    return {
      success: false,
      data: collected,
      error: (err as Error).message,
    };
  } finally {
    await browser.close();
  }
}
