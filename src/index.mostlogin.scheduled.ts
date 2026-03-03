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
// CONFIG
// -------------------------------------------------------------------
const ROUNDS = 30;
const PROFILES_PER_ROUND = 12;
const ROUND_INTERVAL_MS = 60_000; // 1 minute between each round start
const LAUNCH_STAGGER_MS = 2_000; // 2 s between profile launches within a round

const USERNAME = process.env.BOT_USERNAME ?? "";
const PASSWORD = process.env.BOT_PASSWORD ?? "";

// -------------------------------------------------------------------
// FLOW DEFINITIONS  (same set as index.mostlogin.ts)
// -------------------------------------------------------------------
type FlowRunner = (page: Page, label: string) => Promise<void>;

const PUBLIC_FLOWS: Array<{ name: string; run: FlowRunner }> = [
  {
    name: "browseHomepage",
    run: async (page, label) => {
      const r = await browseHomepage(page);
      console.log(`  [${label}] hero: ${r.heroHeading}`);
      console.log(
        `  [${label}] features: ${r.featureNames.length}  tiers: ${r.pricingTiers.length}  footer: ${r.footerLinks.length}`,
      );
    },
  },
  {
    name: "browseFooterLinks",
    run: async (page, label) => {
      const r = await browseFooterLinks(page);
      for (const v of r.visited) {
        console.log(`  [${label}] ${v.path} → "${v.heading}"`);
      }
    },
  },
  {
    name: "explorePricing",
    run: async (page, label) => {
      const r = await explorePricing(page);
      console.log(
        `  [${label}] tiers: ${r.tiers.map((t) => t.name).join(", ") || "(none)"}`,
      );
      console.log(`  [${label}] CTAs valid: ${r.ctaLinksValid}`);
    },
  },
];

const AUTH_FLOW: { name: string; run: FlowRunner } = {
  name: "login+dashboard",
  run: async (page, label) => {
    const lr = await login(page, USERNAME, PASSWORD);
    if (!lr.success) {
      console.error(`  [${label}] Login failed: ${lr.errorMessage}`);
      return;
    }
    console.log(`  [${label}] Logged in: ${lr.finalUrl}`);
    const ar = await accountDashboard(page);
    console.log(
      `  [${label}] balance: ${ar.creditBalance}  orders: ${ar.orders.length}`,
    );
  },
};

function pickFlows(): Array<{ name: string; run: FlowRunner }> {
  const shuffled = [...PUBLIC_FLOWS].sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * PUBLIC_FLOWS.length) + 1;
  const picked = shuffled.slice(0, count);
  if (USERNAME && PASSWORD && Math.random() > 0.5) picked.push(AUTH_FLOW);
  return picked;
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
    const flows = pickFlows();
    console.log(`[${label}] flows: ${flows.map((f) => f.name).join(" → ")}`);
    for (const flow of flows) {
      console.log(`\n[${label}] ${flow.name}...`);
      await flow.run(page, label);
    }
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
  console.log("MostLogin scheduled bot — eurocookflow.com");
  console.log(
    `${ROUNDS} rounds × ${PROFILES_PER_ROUND} profiles, every ${ROUND_INTERVAL_MS / 1000}s`,
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
