import "dotenv/config";
import path from "node:path";
import {
  appendSimilarwebObservation,
  extractSimilarwebSnapshot,
  fetchSimilarwebHtml,
  parseSimilarwebAppDataFromHtml,
  readTelemetryRecords,
  resolvePatchrightTelemetryPath,
  summarizeTelemetryWindow,
  type SimilarwebObservationRecord,
  type SimilarwebSnapshot,
} from "../observability/similarwebSignal";

interface CliOptions {
  domain: string;
  hours: number;
  telemetryPath: string;
  outputPath: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    domain: process.env.SIMILARWEB_DOMAIN ?? "eurocookflow.com",
    hours: Number.parseInt(process.env.SIMILARWEB_WINDOW_HOURS ?? "2", 10),
    telemetryPath:
      process.env.SIMILARWEB_TELEMETRY_JSONL ??
      resolvePatchrightTelemetryPath(process.cwd()),
    outputPath:
      process.env.SIMILARWEB_OBSERVATION_JSONL ??
      path.resolve(process.cwd(), "telemetry", "similarweb.observations.jsonl"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--domain" && next) {
      options.domain = next;
      index += 1;
      continue;
    }
    if (value === "--hours" && next) {
      options.hours = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (value === "--telemetry" && next) {
      options.telemetryPath = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }
    if (value === "--output" && next) {
      options.outputPath = path.resolve(process.cwd(), next);
      index += 1;
    }
  }

  if (!Number.isFinite(options.hours) || options.hours <= 0) {
    throw new Error(`Invalid --hours value: ${options.hours}`);
  }

  return options;
}

function buildObservationNote(input: {
  telemetrySessionCount: number;
  snapshot: SimilarwebSnapshot | null;
  fetchSource: string;
  fetchStatus: number | null;
  challengeHeader: string | null;
}): string {
  if (input.telemetrySessionCount === 0) {
    return "marketingbot recorded no patchright sessions in the requested window";
  }

  if (!input.snapshot && input.challengeHeader) {
    return `Similarweb direct fetch hit a challenge (${input.challengeHeader}); use SCRAPFLY_KEY for a bypassed fetch`;
  }

  if (!input.snapshot && input.fetchStatus === 202) {
    return "Similarweb accepted the request but returned an anti-bot challenge instead of page data";
  }

  if (!input.snapshot) {
    return "Similarweb page could not be parsed into a public observation snapshot";
  }

  return "public Similarweb snapshot captured successfully; note that this is a coarse modeled snapshot, not a literal 2-hour visit counter";
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const records = await readTelemetryRecords(options.telemetryPath);
  const telemetry = summarizeTelemetryWindow(records, {
    windowHours: options.hours,
  });

  let snapshot: SimilarwebSnapshot | null = null;
  let fetchSource: SimilarwebObservationRecord["fetch"]["source"] = "none";
  let fetchStatus: number | null = null;
  let challengeHeader: string | null = null;

  try {
    const fetched = await fetchSimilarwebHtml(options.domain);
    fetchSource = fetched.source;
    fetchStatus = fetched.status;
    challengeHeader = fetched.challengeHeader;

    if (fetched.html.trim()) {
      const appData = parseSimilarwebAppDataFromHtml(fetched.html);
      snapshot = extractSimilarwebSnapshot(appData, options.domain);
    }
  } catch (error) {
    challengeHeader = (error as Error).message;
  }

  const note = buildObservationNote({
    telemetrySessionCount: telemetry.sessionCount,
    snapshot,
    fetchSource,
    fetchStatus,
    challengeHeader,
  });

  const record: SimilarwebObservationRecord = {
    observedAt: new Date().toISOString(),
    domain: options.domain,
    hours: options.hours,
    telemetry,
    fetch: {
      source: fetchSource,
      status: fetchStatus,
      challengeHeader,
    },
    similarweb: {
      snapshot,
      note,
    },
  };

  await appendSimilarwebObservation(record, options.outputPath);

  console.log(JSON.stringify(record, null, 2));
}

run().catch((error) => {
  console.error(
    `[similarweb-signal] Failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
  );
  process.exit(1);
});
