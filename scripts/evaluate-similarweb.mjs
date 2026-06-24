#!/usr/bin/env node
/**
 * evaluate-similarweb.mjs — Arbor evaluation harness
 * 
 * Measures whether the Similarweb API can be called for a target domain.
 * 
 * Score: 0-100 based on:
 *   - Whether data.similarweb.com/api/v1/data returned 200 (40 pts)
 *   - Whether GlobalRank data is present (30 pts)
 *   - Whether Engagments data is present (20 pts)
 *   - Whether EstimatedMonthlyVisits has data (10 pts)
 * 
 * Usage: node scripts/evaluate-similarweb.mjs <domain>
 *   e.g. node scripts/evaluate-similarweb.mjs guidenza.com
 */

import { fetchSimilarwebApiData } from "../src/flows/triggerSimilarweb.ts";

const TARGET_DOMAIN = process.argv[2] || "guidenza.com";

async function run() {
  console.log(`\n🔍 Evaluating Similarweb API for: ${TARGET_DOMAIN}`);

  const result = await fetchSimilarwebApiData(TARGET_DOMAIN);

  let score = 0;
  
  // 40 pts: API returned 200
  if (result.status === 200) score += 40;
  
  // 30 pts: GlobalRank present
  const data = result.data;
  if (data?.GlobalRank?.Rank != null) score += 30;
  
  // 20 pts: Engagments data present
  if (data?.Engagments?.Visits > 0) score += 20;
  
  // 10 pts: EstimatedMonthlyVisits has data
  const monthlyVisits = data?.EstimatedMonthlyVisits;
  if (monthlyVisits && Object.keys(monthlyVisits).length > 0) score += 10;

  console.log(`\n📊 Score: ${score}/100`);
  console.log(`   API status: ${result.status}`);
  console.log(`   GlobalRank: ${data?.GlobalRank?.Rank ?? "N/A"}`);
  console.log(`   Visits: ${data?.Engagments?.Visits ?? "N/A"}`);
  console.log(`   IsSmall: ${data?.IsSmall ?? "N/A"}`);
  console.log(`   Monthly history points: ${monthlyVisits ? Object.keys(monthlyVisits).length : 0}`);

  // Output score for Arbor
  console.log(`\nscore: ${score}`);
}

run().catch((err) => {
  console.error("Evaluation failed:", err);
  console.log("\nscore: 0");
  process.exit(1);
});
