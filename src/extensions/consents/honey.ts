// playwright-ignore
import { Page } from "playwright";

export async function dismissHoneyConsents(page: Page): Promise<void> {
  // Common selectors for consent dialogs for Honey
  const consentSelectors = [
    'button:has-text("Accept all")',
    'button:has-text("Allow all")',
    'button[id*="consent"][id*="accept"]',
    'button[class*="consent"][class*="accept"]',
    '[class*="honey"] button:has-text("Accept")',
    '[class*="consent-dialog"] button:has-text("Agree")',
  ];

  for (const selector of consentSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click({ timeout: 1000 });
        await page.waitForTimeout(500); // Give time for the popup to disappear
        console.log(`  [extension:honey] Dismissed consent using selector: "${selector}"`);
        return;
      }
    } catch (error) {
      // Ignore if selector is not found or click fails, try next one
    }
  }
}
