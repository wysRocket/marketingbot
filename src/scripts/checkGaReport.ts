/**
 * GA4 Unique-User Report
 *
 * Queries Google Analytics 4 to verify that bot visits are being counted as
 * unique users. Shows both a real-time view (last 30 min) and today's hourly
 * sessions/new-users breakdown.
 *
 * SETUP — one-time:
 *   1. Go to https://console.cloud.google.com → your project
 *   2. APIs & Services → Enable "Google Analytics Data API"
 *   3. IAM & Admin → Service Accounts → Create a service account (any name)
 *   4. Create a JSON key for that service account → download the .json file
 *   5. In GA4: Admin → Property Access Management → Add the service account
 *      email (xxxx@project.iam.gserviceaccount.com) as "Viewer"
 *   6. Add to .env:
 *        GA_KEY_FILE=/path/to/service-account-key.json
 *        GA4_PROPERTY_ID=properties/XXXXXXXXX
 *      (find property ID in GA4 → Admin → Property Settings)
 *
 * USAGE:
 *   npm run ga:report
 *   npm run ga:report -- --realtime    # only realtime (last 30 min)
 *   npm run ga:report -- --today       # only hourly breakdown for today
 */

import "dotenv/config";
import * as crypto from "crypto";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Service account auth — pure Node.js, no googleapis SDK needed
// ---------------------------------------------------------------------------

interface ServiceAccount {
  private_key: string;
  client_email: string;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = b64url(signer.sign(sa.private_key));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// GA4 API helpers
// ---------------------------------------------------------------------------

async function runReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 runReport failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function runRealtimeReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runRealtimeReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 runRealtimeReport failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

interface Row {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

interface ReportResponse {
  rows?: Row[];
  rowCount?: number;
}

function renderTable(report: ReportResponse, headers: string[]): void {
  const rows = report.rows ?? [];
  if (rows.length === 0) {
    console.log("  (no data)\n");
    return;
  }

  const widths = headers.map((h) => h.length);
  for (const row of rows) {
    const vals = [
      ...row.dimensionValues.map((d) => d.value),
      ...row.metricValues.map((m) => m.value),
    ];
    vals.forEach((v, i) => {
      widths[i] = Math.max(widths[i] ?? 0, v.length);
    });
  }

  const line = widths.map((w) => "-".repeat(w + 2)).join("+");
  const fmt = (vals: string[]) =>
    vals.map((v, i) => ` ${v.padEnd(widths[i] ?? 0)} `).join("|");

  console.log(`+${line}+`);
  console.log(`|${fmt(headers)}|`);
  console.log(`+${line}+`);
  for (const row of rows) {
    const vals = [
      ...row.dimensionValues.map((d) => d.value),
      ...row.metricValues.map((m) => m.value),
    ];
    console.log(`|${fmt(vals)}|`);
  }
  console.log(`+${line}+`);
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const keyFile = process.env.GA_KEY_FILE;
  const propertyId = process.env.GA4_PROPERTY_ID;

  if (!keyFile || !propertyId) {
    console.error(
      "Missing env vars. Add to .env:\n" +
        "  GA_KEY_FILE=/path/to/service-account-key.json\n" +
        "  GA4_PROPERTY_ID=properties/XXXXXXXXX",
    );
    process.exit(1);
  }

  const sa: ServiceAccount = JSON.parse(fs.readFileSync(keyFile, "utf8"));
  const token = await getAccessToken(sa);

  const args = process.argv.slice(2);
  const wantRealtime = args.includes("--realtime") || !args.includes("--today");
  const wantToday = args.includes("--today") || !args.includes("--realtime");

  // ── Realtime: active users right now ──────────────────────────────────────
  if (wantRealtime) {
    console.log("=== REALTIME — active users in the last 30 minutes ===\n");

    const rt = (await runRealtimeReport(propertyId, token, {
      dimensions: [
        { name: "country" },
        { name: "city" },
        { name: "unifiedScreenName" },
      ],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 30,
    })) as ReportResponse;

    renderTable(rt, ["country", "city", "page", "activeUsers"]);

    // Summary totals
    const total = (rt.rows ?? []).reduce(
      (sum, r) => sum + parseInt(r.metricValues[0]?.value ?? "0", 10),
      0,
    );
    console.log(`  Total active users right now: ${total}\n`);
  }

  // ── Today: sessions + new users by hour ───────────────────────────────────
  if (wantToday) {
    console.log("=== TODAY — sessions & new users by hour ===\n");

    const today = (await runReport(propertyId, token, {
      dimensions: [{ name: "dateHour" }],
      metrics: [
        { name: "sessions" },
        { name: "newUsers" },
        { name: "activeUsers" },
        { name: "bounceRate" },
      ],
      dateRanges: [{ startDate: "today", endDate: "today" }],
      orderBys: [{ dimension: { dimensionName: "dateHour" }, desc: true }],
      limit: 24,
    })) as ReportResponse;

    renderTable(today, [
      "dateHour",
      "sessions",
      "newUsers",
      "activeUsers",
      "bounceRate",
    ]);

    // Uniqueness ratio
    const rows = today.rows ?? [];
    const totalSessions = rows.reduce(
      (s, r) => s + parseInt(r.metricValues[0]?.value ?? "0", 10),
      0,
    );
    const totalNewUsers = rows.reduce(
      (s, r) => s + parseInt(r.metricValues[1]?.value ?? "0", 10),
      0,
    );
    console.log(
      `  Today total  → sessions: ${totalSessions}  new users: ${totalNewUsers}`,
    );
    if (totalSessions > 0) {
      const pct = ((totalNewUsers / totalSessions) * 100).toFixed(1);
      console.log(
        `  New-user rate: ${pct}%  ${parseFloat(pct) >= 80 ? "✓ looking good" : "⚠ low — sessions may not be resolving as unique users"}`,
      );
    }
    console.log();
  }

  // ── Channel breakdown ──────────────────────────────────────────────────────
  if (wantToday) {
    console.log("=== TODAY — sessions by channel ===\n");

    const channels = (await runReport(propertyId, token, {
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "newUsers" }],
      dateRanges: [{ startDate: "today", endDate: "today" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    })) as ReportResponse;

    renderTable(channels, ["channel", "sessions", "newUsers"]);
  }
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
