import "dotenv/config";
import { connectMostLoginProfile } from "./browser";
import { browseHomepage } from "./flows/browseHomepage";
import { browseFooterLinks } from "./flows/browseFooterLinks";
import { login } from "./flows/login";
import { explorePricing } from "./flows/explorePricing";
import { accountDashboard } from "./flows/accountDashboard";
import { listProfiles } from "./mcp/mostlogin/tools/profiles";
import { closeProfiles } from "./mcp/mostlogin/tools/browsers";
import {
  getSessionPolicyFromEnv,
  runComplexSession,
  type NamedFlow,
} from "./session/complexSession";
import { createTelemetryPersistence } from "./session/telemetryPersistence";
import { getActiveSiteProfile, isFlowEnabled } from "./sites";

// -------------------------------------------------------------------
// CREDENTIALS
// Set BOT_USERNAME and BOT_PASSWORD in .env to enable authenticated flows.
// -------------------------------------------------------------------
const USERNAME = process.env.BOT_USERNAME ?? "";
const PASSWORD = process.env.BOT_PASSWORD ?? "";
const SESSION_POLICY = getSessionPolicyFromEnv();
const TELEMETRY = createTelemetryPersistence("mostlogin");
const SITE = getActiveSiteProfile();

function pickRandom<T>(items: T[], limit: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, limit);
}

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
  const toUse = pickRandom(fetchedIds, 10);
  console.log(
    `[setup] Found ${profiles.length} profile(s), randomly selected ${toUse.length}`,
  );
  return toUse;
}

function buildFlowSequence(username: string, password: string): NamedFlow[] {
  const flows: NamedFlow[] = [];

  if (isFlowEnabled(SITE, "browseHomepage")) {
    flows.push({
      name: "browseHomepage",
      run: async (page, label, ctx) => {
        const result = await browseHomepage(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(3);

        console.log(`  [${label}] hero: ${result.heroHeading}`);
        console.log(`  [${label}] features found: ${result.featureNames.length}`);
        console.log(`  [${label}] pricing tiers: ${result.pricingTiers.length}`);
        console.log(`  [${label}] footer links: ${result.footerLinks.length}`);
      },
    });
  }

  if (isFlowEnabled(SITE, "explorePricing")) {
    flows.push({
      name: "explorePricing",
      run: async (page, label, ctx) => {
        const result = await explorePricing(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(3);

        console.log(
          `  [${label}] tiers: ${result.tiers.map((t) => t.name).join(", ") || "(none named)"}`,
        );
        console.log(`  [${label}] CTA links valid: ${result.ctaLinksValid}`);
      },
    });
  }

  if (isFlowEnabled(SITE, "browseFooterLinks")) {
    flows.push({
      name: "browseFooterLinks",
      run: async (page, label, ctx) => {
        const result = await browseFooterLinks(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(result.visited.length + 1);

        for (const visit of result.visited) {
          console.log(
            `  [${label}] ${visit.path} → "${visit.heading}" (${visit.url})`,
          );
        }
      },
    });
  }

  if (username && password && isFlowEnabled(SITE, "login")) {
    flows.push({
      name: isFlowEnabled(SITE, "accountDashboard") ? "login+dashboard" : "login",
      run: async (page, label, ctx) => {
        const loginResult = await login(page, username, password, SITE);
        ctx.trackNavigation(loginResult.finalUrl);
        ctx.addInteraction(2);

        if (!loginResult.success) {
          const warning = `Login failed: ${loginResult.errorMessage ?? "Unknown auth error"}`;
          ctx.addWarning(warning);
          console.error(`  [${label}] ${warning}`);
          return;
        }

        console.log(`  [${label}] Logged in. Landed: ${loginResult.finalUrl}`);

        if (!isFlowEnabled(SITE, "accountDashboard")) {
          return;
        }

        const accountResult = await accountDashboard(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(2);

        console.log(`  [${label}] Credit balance: ${accountResult.creditBalance}`);
        console.log(
          `  [${label}] Orders on record: ${accountResult.orders.length}`,
        );
        console.log(
          `  [${label}] Payment methods present: ${accountResult.hasPaymentMethods}`,
        );
      },
    });
  }

  if (flows.length === 0) {
    throw new Error(
      `No enabled flows for site profile \"${SITE.id}\". Check src/sites/profiles/${SITE.id}.json`,
    );
  }

  return flows;
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
    const flows = buildFlowSequence(USERNAME, PASSWORD);

    console.log(
      `[${label}] Flows selected: ${flows.map((f) => f.name).join(" → ")}`,
    );

    const telemetry = await runComplexSession({
      page,
      label,
      flows,
      policy: SESSION_POLICY,
      baseUrl: SITE.baseUrl,
      seedCandidates: SITE.session.seedCandidates,
    });

    console.log(
      `[${label}] Session telemetry: ${Math.round(telemetry.elapsedMs / 1000)}s, ${telemetry.uniquePages.length} unique page(s), ${telemetry.interactions} interaction unit(s)`,
    );
    console.log(
      `  [${label}] traffic: ${(telemetry.trafficBytesTotal / (1024 * 1024)).toFixed(2)} MB total, ${(telemetry.trafficBytesSameOrigin / (1024 * 1024)).toFixed(2)} MB same-origin, ${telemetry.trafficRequestCount} request(s)`,
    );
    console.log(
      `  [${label}] top origins: ${
        telemetry.trafficTopOrigins
          .slice(0, 3)
          .map(
            (item) =>
              `${item.key} ${(item.bytes / (1024 * 1024)).toFixed(2)}MB/${item.requests}req`,
          )
          .join(" | ") || "(none)"
      }`,
    );
    console.log(`  [${label}] URLs: ${telemetry.uniquePages.join(" | ")}`);

    for (const warning of telemetry.warnings) {
      console.warn(`  [${label}] warning: ${warning}`);
    }

    await TELEMETRY.persistSession({
      label,
      profileId,
      telemetry,
      policy: SESSION_POLICY,
    }).catch((err) => {
      console.warn(
        `  [${label}] warning: failed to persist telemetry: ${(err as Error).message}`,
      );
    });
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
  console.log(`Starting MostLogin bot session for ${SITE.baseUrl}/ (${SITE.id})\n`);
  console.log(`[telemetry] JSONL: ${TELEMETRY.jsonPath}`);
  console.log(`[telemetry] CSV:   ${TELEMETRY.csvPath}\n`);
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
