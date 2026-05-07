import "dotenv/config";
import { getActiveSiteProfile } from "./sites";
import { buildProxy } from "./proxy";
import { runOrchestrator } from "./agents/orchestrator";
import type { AgentTask } from "./agents/patchrightAgent";

async function main() {
  const siteProfile = getActiveSiteProfile();
  const proxyUrl = buildProxy();

  const agentCount = parseInt(process.env.AGENT_COUNT ?? "100", 10);
  const concurrency = parseInt(process.env.CONCURRENCY ?? "10", 10);
  const maxRetries = parseInt(process.env.MAX_RETRIES ?? "2", 10);

  console.log(`Site:        ${siteProfile.id} (${siteProfile.baseUrl})`);
  console.log(`Proxy:       ${proxyUrl ? proxyUrl.replace(/:[^:@]+@/, ":***@") : "none (direct)"}`);
  console.log(`Agents:      ${agentCount}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Max retries: ${maxRetries}`);
  console.log("");

  const taskDescription =
    process.env.AGENT_TASK ??
    `Browse the website naturally. Visit the homepage, explore navigation links, scroll through pages, and spend at least 45 seconds on the site. Do not submit any forms or create accounts.`;

  const tasks: AgentTask[] = Array.from({ length: agentCount }, (_, i) => ({
    agentIndex: i + 1,
    siteProfile,
    taskDescription,
    proxyUrl,
  }));

  const startMs = Date.now();
  const results = await runOrchestrator(tasks, { concurrency, maxRetries });
  const totalMs = Date.now() - startMs;

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const avgDuration =
    results.reduce((sum, r) => sum + r.durationMs, 0) / results.length / 1000;

  console.log("\n=== Summary ===");
  console.log(`Total time:     ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`Succeeded:      ${succeeded}/${agentCount}`);
  console.log(`Failed:         ${failed}/${agentCount}`);
  console.log(`Avg duration:   ${avgDuration.toFixed(1)}s per agent`);

  if (failed > 0) {
    console.log("\nFailed agents:");
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  agent ${r.agentIndex}: ${r.error}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
