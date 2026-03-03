import { Page } from 'playwright';

/** Return the trimmed text content of a single element. */
export async function getText(page: Page, selector: string): Promise<string> {
  await page.waitForSelector(selector, { timeout: 10_000 });
  return (await page.textContent(selector))?.trim() ?? '';
}

/** Return the text content of every element matching the selector. */
export async function getAll(page: Page, selector: string): Promise<string[]> {
  await page.waitForSelector(selector, { timeout: 10_000 });
  return page.$$eval(selector, (els) =>
    els.map((el) => el.textContent?.trim() ?? '')
  );
}

/**
 * Extract all href links from elements matching the selector.
 * Relative links are resolved to absolute URLs using the page's current URL.
 */
export async function getLinks(page: Page, selector = 'a'): Promise<string[]> {
  const pageUrl = page.url();
  return page.$$eval(
    selector,
    (els, base) =>
      els
        .map((el) => {
          const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
          try { return new URL(href, base).href; } catch { return ''; }
        })
        .filter(Boolean),
    pageUrl
  );
}

/**
 * Scrape a table into an array of row objects keyed by header text.
 * Assumes the first row contains <th> headers.
 */
export async function scrapeTable(
  page: Page,
  tableSelector = 'table'
): Promise<Record<string, string>[]> {
  return page.$eval(tableSelector, (table: Element) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    const headers = Array.from(rows[0]?.querySelectorAll('th') ?? []).map(
      (th: Element) => th.textContent?.trim() ?? ''
    );
    return rows.slice(1).map((row: Element) => {
      const cells = Array.from(row.querySelectorAll('td')).map(
        (td: Element) => td.textContent?.trim() ?? ''
      );
      return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    });
  });
}
