import "dotenv/config";
import { Page } from "playwright";
import { connectMostLoginProfile } from "./browser";
import { browseHomepage } from "./flows/browseHomepage";
import { browseFooterLinks } from "./flows/browseFooterLinks";
import { login } from "./flows/login";
import { explorePricing } from "./flows/explorePricing";
import { accountDashboard } from "./flows/accountDashboard";
import { listProfiles } from "./mcp/mostlogin/tools/profiles";
import { closeProfiles } from "./mcp/mostlogin/tools/browsers";

// -------------------------------------------------------------------
// CREDENTIALS
// Set BOT_USERNAME and BOT_PASSWORD in .env to enable authenticated flows.
// -------------------------------------------------------------------
const USERNAME = process.env.BOT_USERNAME ?? "";
const PASSWORD = process.env.BOT_PASSWORD ?? "";

// -------------------------------------------------------------------
// PROFILE DISCOVERY
//
// If ML_PROFILE_IDS is set in .env, use those IDs (comma-separated).
// Otherwise, automatically fetch up to 10 profiles from MostLogin.
// -------------------------------------------------------------------
async function getProfileIds(): Promise<string[]> {
  const manual = process.env.ML_PROFILE_IDS ?? "";
  const ids = manual
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length > 0) {
    console.log(
      `[setup] Using ${ids.length} profile(s) from ML_PROFILE_IDS env var`,
    );
    return ids.slice(0, 10);
  }

  console.log("[setup] Fetching available profiles from MostLogin...");
  const result = await listProfiles(1, 100);
  const profiles: Array<{ id: string }> = result?.list ?? [];

  if (profiles.length === 0) {
    throw new Error(
      "No profiles found in MostLogin. " +
        "Set ML_PROFILE_IDS in .env to specify profile IDs manually.",
    );
  }

  const fetchedIds = profiles.map((p) => p.id);
  const toUse = fetchedIds.slice(0, 10);
  console.log(
    `[setup] Found ${profiles.length} profile(s), using first ${toUse.length}`,
  );
  return toUse;
}

// -------------------------------------------------------------------
// FLOW DEFINITIONS
// -------------------------------------------------------------------
type FlowRunner = (page: Page, label: string) => Promise<void>;

const PUBLIC_FLOWS: Array<{ name: string; run: FlowRunner }> = [
  {
    name: "browseHomepage",
    run: async (page, label) => {
      const result = await browseHomepage(page);
      console.log(`  [${label}] hero: ${result.heroHeading}`);
      console.log(`  [${label}] features found: ${result.featureNames.length}`);
      console.log(`  [${label}] pricing tiers: ${result.pricingTiers.length}`);
      console.log(`  [${label}] footer links: ${result.footerLinks.length}`);
    },
  },
  {
    name: "browseFooterLinks",
    run: async (page, label) => {
      const result = await browseFooterLinks(page);
      for (const visit of result.visited) {
        console.log(
          `  [${label}] ${visit.path} → "${visit.heading}" (${visit.url})`,
        );
      }
    },
  },
  {
    name: "explorePricing",
    run: async (page, label) => {
      const result = await explorePricing(page);
      console.log(
        `  [${label}] tiers: ${result.tiers.map((t) => t.name).join(", ") || "(none named)"}`,
      );
      console.log(`  [${label}] CTA links valid: ${result.ctaLinksValid}`);
    },
  },
];

const AUTH_FLOW: { name: string; run: FlowRunner } = {
  name: "login+dashboard",
  run: async (page, label) => {
    const loginResult = await login(page, USERNAME, PASSWORD);
    if (!loginResult.success) {
      console.error(`  [${label}] Login failed: ${loginResult.errorMessage}`);
      return;
    }
    console.log(`  [${label}] Logged in. Landed: ${loginResult.finalUrl}`);
    const accountResult = await accountDashboard(page);
    console.log(`  [${label}] Credit balance: ${accountResult.creditBalance}`);
    console.log(
      `  [${label}] Orders on record: ${accountResult.orders.length}`,
    );
    console.log(
      `  [${label}] Payment methods present: ${accountResult.hasPaymentMethods}`,
    );
  },
};

function pickFlows(): Array<{ name: string; run: FlowRunner }> {
  const shuffled = [...PUBLIC_FLOWS].sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * PUBLIC_FLOWS.length) + 1;
  const picked = shuffled.slice(0, count);

  if (USERNAME && PASSWORD && Math.random() > 0.5) {
    picked.push(AUTH_FLOW);
  }

  return picked;
}

// -------------------------------------------------------------------
// SESSION RUNNER
// -------------------------------------------------------------------
async function runProfileSession(
  profileId: string,
  label: string,
): Promise<void> {
  const browser = await connectMostLoginProfile(profileId);

  try {
    const page = await browser.newPage();
    const flows = pickFlows();

    console.log(
      `[${label}] Flows selected: ${flows.map((f) => f.name).join(" → ")}`,
    );

    for (const flow of flows) {
      console.log(`\n[${label}] Running: ${flow.name}...`);
      await flow.run(page, label);
    }
  } finally {
    // Use closeProfiles to terminate the browser AND reset MostLogin's status
    // flag back to 0. Do NOT call browser.close() first — it kills the Chrome
    // process via CDP without notifying MostLogin, leaving profiles stuck at
    // status=1 (locked) with no way to reopen them until manually unlocked.
    await closeProfiles([profileId]).catch(() => {});
  }
}

// -------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------
(async () => {
  console.log("Starting MostLogin bot session for https://eurocookflow.com/\n");
  const profileIds = await getProfileIds();
  console.log(`Running ${profileIds.length} profile(s) in parallel...\n`);

  // Stagger launches by 3 s each to avoid thundering-herd on the proxy/server.
  const sessions = profileIds.map((profileId, index) => {
    const label = `P${index + 1}`;
    return new Promise<void>((resolve) => setTimeout(resolve, index * 3_000))
      .then(() => runProfileSession(profileId, label))
      .catch((err) => ({ label, error: err as Error }));
  });

  const results = await Promise.all(sessions);
  const failures = results.filter(
    (result): result is { label: string; error: Error } =>
      typeof result === "object" && result !== null && "error" in result,
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(
        `[${failure.label}] Session failed:`,
        failure.error.message,
      );
    }
    process.exit(1);
  }

  console.log("\nSession complete.");
})();
