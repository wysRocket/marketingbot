import { Page } from "playwright";

/** Click an element and wait briefly to let the page react. */
export async function click(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout: 10_000 });
  await page.click(selector);
}

/** Type into a text field, clearing any existing value first. */
export async function fill(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout: 10_000 });
  await page.fill(selector, value);
}

/** Select an option from a <select> element by its visible label. */
export async function selectOption(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  await page.selectOption(selector, { label });
}

/** Scroll the page down by a number of viewport heights. */
export async function scrollDown(page: Page, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(500);
  }
}

/** Hover over an element (useful for triggering hover menus). */
export async function hover(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout: 10_000 });
  await page.hover(selector);
}

/** Return a random integer in [min, max] inclusive. */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Wait for a random duration between minMs and maxMs milliseconds. */
export async function randomDelay(
  page: Page,
  minMs: number,
  maxMs: number,
): Promise<void> {
  await page.waitForTimeout(randomInt(minMs, maxMs));
}

type RandomAction = "scrollDown" | "scrollUp" | "hover" | "pause";

/**
 * Simulate organic browsing on the current page for a randomised duration.
 *
 * The bot stays between minMs and maxMs milliseconds and spends that time
 * doing a mix of: scrolling down, scrolling back up a little, hovering over
 * random visible elements, and pausing to simulate reading.
 *
 * Action distribution (approximate):
 *   40 % scrollDown · 20 % scrollUp · 20 % hover · 20 % pause
 */
export async function randomBrowse(
  page: Page,
  minMs = 8_000,
  maxMs = 25_000,
): Promise<void> {
  const deadline = Date.now() + randomInt(minMs, maxMs);

  while (Date.now() < deadline) {
    const roll = Math.random();
    const action: RandomAction =
      roll < 0.4
        ? "scrollDown"
        : roll < 0.6
          ? "scrollUp"
          : roll < 0.8
            ? "hover"
            : "pause";

    switch (action) {
      case "scrollDown": {
        const px = randomInt(200, 700);
        await page.evaluate(
          (amount) => window.scrollBy({ top: amount, behavior: "smooth" }),
          px,
        );
        await page.waitForTimeout(randomInt(600, 1_800));
        break;
      }

      case "scrollUp": {
        const px = randomInt(100, 400);
        await page.evaluate(
          (amount) => window.scrollBy({ top: -amount, behavior: "smooth" }),
          px,
        );
        await page.waitForTimeout(randomInt(400, 1_200));
        break;
      }

      case "hover": {
        const candidates = await page.$$("h1, h2, h3, p, a");
        if (candidates.length > 0) {
          const el = candidates[randomInt(0, candidates.length - 1)];
          await el.hover().catch(() => {
            /* non-critical */
          });
          await page.waitForTimeout(randomInt(300, 900));
        }
        break;
      }

      case "pause": {
        await page.waitForTimeout(randomInt(1_000, 3_500));
        break;
      }
    }
  }
}
