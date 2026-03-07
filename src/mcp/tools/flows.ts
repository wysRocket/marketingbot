import { z } from "zod";
import { connectProfile, launchSession } from "../../browser";
import { browseHomepage } from "../../flows/browseHomepage";
import { browseFooterLinks } from "../../flows/browseFooterLinks";
import { login } from "../../flows/login";
import { explorePricing } from "../../flows/explorePricing";
import { accountDashboard } from "../../flows/accountDashboard";
import type { Browser } from "playwright";
import { getActiveSiteProfile } from "../../sites";

const SITE = getActiveSiteProfile();

// ── Schemas ───────────────────────────────────────────────────────────

const profileIdField = z
  .string()
  .optional()
  .describe(
    "Nstbrowser profile ID. When provided the saved profile is launched via CDP. " +
      "Omit to use a plain Playwright session (direct IP, no antidetect).",
  );

export const RunBrowseHomepageSchema = {
  profileId: profileIdField,
};

export const RunBrowseFooterLinksSchema = {
  profileId: profileIdField,
};

export const RunLoginSchema = {
  username: z.string().describe(`${SITE.label} username/email`),
  password: z.string().describe(`${SITE.label} password`),
  profileId: profileIdField,
};

export const RunExplorePricingSchema = {
  profileId: profileIdField,
};

export const RunAccountDashboardSchema = {
  username: z
    .string()
    .describe(
      `${SITE.label} username/email — the flow will login before loading the configured dashboard route`,
    ),
  password: z.string().describe(`${SITE.label} password`),
  profileId: profileIdField,
};

// ── Helpers ───────────────────────────────────────────────────────────

async function openBrowser(profileId?: string): Promise<Browser> {
  if (profileId) {
    return connectProfile(profileId);
  }
  return launchSession(); // no proxy → plain Playwright, direct IP
}

// ── Handlers ─────────────────────────────────────────────────────────

export async function runBrowseHomepage(profileId?: string) {
  const browser = await openBrowser(profileId);
  try {
    const page = await browser.newPage();
    const result = await browseHomepage(page, SITE);
    await page.close();
    return result;
  } finally {
    await browser.close();
  }
}

export async function runBrowseFooterLinks(profileId?: string) {
  const browser = await openBrowser(profileId);
  try {
    const page = await browser.newPage();
    const result = await browseFooterLinks(page, SITE);
    await page.close();
    return result;
  } finally {
    await browser.close();
  }
}

export async function runLogin(
  username: string,
  password: string,
  profileId?: string,
) {
  const browser = await openBrowser(profileId);
  try {
    const page = await browser.newPage();
    const result = await login(page, username, password, SITE);
    await page.close();
    return result;
  } finally {
    await browser.close();
  }
}

export async function runExplorePricing(profileId?: string) {
  const browser = await openBrowser(profileId);
  try {
    const page = await browser.newPage();
    const result = await explorePricing(page, SITE);
    await page.close();
    return result;
  } finally {
    await browser.close();
  }
}

export async function runAccountDashboard(
  username: string,
  password: string,
  profileId?: string,
) {
  const browser = await openBrowser(profileId);
  try {
    const page = await browser.newPage();

    // accountDashboard requires an authenticated session — login first
    const loginResult = await login(page, username, password, SITE);
    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.errorMessage}`);
    }

    const accountResult = await accountDashboard(page, SITE);
    await page.close();
    return { login: loginResult, account: accountResult };
  } finally {
    await browser.close();
  }
}
