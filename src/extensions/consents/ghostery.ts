// playwright-ignore
import { Page } from "playwright";

export async function dismissGhosteryConsents(page: Page): Promise<void> {
  // Common selectors for consent dialogs for Ghostery
  const consentSelectors = [
    'button:has-text("Accept cookies")',
    'button:has-text("Agree")',
    'button[id*="ghostery"][id*="accept"]',
    'input[value*="Accept"]',
    'a[class*="ghostery"] + button',
  ];

  for (const selector of consentSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click({ timeout: 1000 });
        await page.waitForTimeout(500); // Give time for the popup to disappear
        console.log(`  [extension:ghostery] Dismissed consent using selector: "${selector}"`);
        return;
      }
    } catch (error) {
      // Ignore if selector is not found or click fails, try next one
    }
  }
}
