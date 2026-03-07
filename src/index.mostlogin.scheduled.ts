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
// CONFIG
// -------------------------------------------------------------------
const ROUNDS = 180; // 30 min / 10 s per launch
const PROFILES_PER_ROUND = 1;
const ROUND_INTERVAL_MS = 10_000; // 10 seconds between each profile launch
const LAUNCH_STAGGER_MS = 0; // no stagger needed for 1 profile per round

const USERNAME = process.env.BOT_USERNAME ?? "";
const PASSWORD = process.env.BOT_PASSWORD ?? "";
const SESSION_POLICY = getSessionPolicyFromEnv();
const TELEMETRY = createTelemetryPersistence("mostlogin_scheduled");
const SITE = getActiveSiteProfile();

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
        console.log(
          `  [${label}] features: ${result.featureNames.length}  tiers: ${result.pricingTiers.length}  footer: ${result.footerLinks.length}`,
        );
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
          `  [${label}] tiers: ${result.tiers.map((t) => t.name).join(", ") || "(none)"}`,
        );
        console.log(`  [${label}] CTAs valid: ${result.ctaLinksValid}`);
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
          console.log(`  [${label}] ${visit.path} → "${visit.heading}"`);
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

        console.log(`  [${label}] Logged in: ${loginResult.finalUrl}`);

        if (!isFlowEnabled(SITE, "accountDashboard")) {
          return;
        }

        const accountResult = await accountDashboard(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(2);

        console.log(
          `  [${label}] balance: ${accountResult.creditBalance}  orders: ${accountResult.orders.length}`,
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
// CONCURRENCY TRACKING
// Profiles currently open — never launch the same profile twice at once.
// -------------------------------------------------------------------
const activeProfiles = new Set<string>();

function pickProfilesForRound(pool: string[]): string[] {
  const available = pool.filter((id) => !activeProfiles.has(id));
  if (available.length === 0) return [];
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, PROFILES_PER_ROUND);
}

// -------------------------------------------------------------------
// SESSION RUNNER
// -------------------------------------------------------------------
async function runProfileSession(
  profileId: string,
  label: string,
): Promise<void> {
  activeProfiles.add(profileId);
  const browser = await connectMostLoginProfile(profileId);
  try {
    const page = await browser.newPage();
    const flows = buildFlowSequence(USERNAME, PASSWORD);
    console.log(`[${label}] flows: ${flows.map((f) => f.name).join(" → ")}`);

    const telemetry = await runComplexSession({
      page,
      label,
      flows,
      policy: SESSION_POLICY,
      baseUrl: SITE.baseUrl,
      seedCandidates: SITE.session.seedCandidates,
    });

    console.log(
      `[${label}] telemetry: ${Math.round(telemetry.elapsedMs / 1000)}s, ${telemetry.uniquePages.length} unique page(s), warnings=${telemetry.warnings.length}`,
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
    activeProfiles.delete(profileId);
    await closeProfiles([profileId]).catch(() => {});
  }
}

// -------------------------------------------------------------------
// ROUND RUNNER  (fire-and-forget — next round starts on schedule)
// -------------------------------------------------------------------
function fireRound(roundNum: number, pool: string[]): void {
  const profileIds = pickProfilesForRound(pool);

  if (profileIds.length === 0) {
    console.log(
      `\n[round ${roundNum}/${ROUNDS}] All ${pool.length} profiles busy — skipping.`,
    );
    return;
  }

  console.log(
    `\n${"=".repeat(60)}\n` +
      `Round ${roundNum}/${ROUNDS}  —  ${profileIds.length} profiles  ` +
      `(${activeProfiles.size + profileIds.length} will be active)\n` +
      `${"=".repeat(60)}`,
  );

  profileIds.forEach((profileId, i) => {
    const label = `R${roundNum}:P${String(i + 1).padStart(2, "0")}`;
    // Stagger within-round launches to ease proxy load
    setTimeout(() => {
      runProfileSession(profileId, label).catch((err) => {
        activeProfiles.delete(profileId); // ensure cleanup on unexpected throw
        console.error(`[${label}] session error: ${(err as Error).message}`);
      });
    }, i * LAUNCH_STAGGER_MS);
  });
}

// -------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------
(async () => {
  console.log("=".repeat(60));
  console.log(`MostLogin scheduled bot — ${SITE.baseUrl} (${SITE.id})`);
  console.log(`[telemetry] JSONL: ${TELEMETRY.jsonPath}`);
  console.log(`[telemetry] CSV:   ${TELEMETRY.csvPath}`);
  console.log(
    `${ROUNDS} rounds × ${PROFILES_PER_ROUND} profiles, every ${ROUND_INTERVAL_MS / 1000 / 60}min  (${(ROUNDS * ROUND_INTERVAL_MS) / 60_000}min total window)`,
  );
  console.log("=".repeat(60) + "\n");

  const result = await listProfiles(1, 100);
  const profiles: Array<{ id: string }> = result?.list ?? [];

  if (profiles.length === 0) {
    throw new Error(
      "No profiles found in MostLogin. " +
        "Set ML_PROFILE_IDS in .env or check MOSTLOGIN_API_KEY.",
    );
  }

  const pool = profiles.map((p) => p.id);
  console.log(`[setup] Profile pool: ${pool.length} profiles`);

  if (pool.length < PROFILES_PER_ROUND) {
    console.warn(
      `[setup] WARNING: pool (${pool.length}) < profiles per round (${PROFILES_PER_ROUND}). ` +
        `Some rounds will run fewer than ${PROFILES_PER_ROUND} sessions.`,
    );
  }

  let roundsLaunched = 0;

  function launchNextRound(): void {
    roundsLaunched++;
    fireRound(roundsLaunched, pool);
    if (roundsLaunched >= ROUNDS) {
      clearInterval(intervalHandle);
      const remaining = pool.filter((id) => activeProfiles.has(id)).length;
      console.log(
        `\n[scheduler] All ${ROUNDS} rounds launched. ${remaining} sessions still running.`,
      );
    }
  }

  // Round 1 fires immediately; subsequent rounds on the interval.
  launchNextRound();
  const intervalHandle = setInterval(launchNextRound, ROUND_INTERVAL_MS);
})();
