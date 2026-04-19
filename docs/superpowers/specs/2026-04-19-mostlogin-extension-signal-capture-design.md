# MostLogin Extension Signal Capture Design

## Summary

Build a dedicated local analysis workflow that launches an existing MostLogin profile on the Mac, keeps the currently installed extension stack enabled together, runs passive browsing flows, captures full-fidelity outbound traffic, and produces both raw forensic artifacts and a human-readable signal map.

This workflow is not part of the Railway Similarweb traffic lane. It is a sidecar analysis tool meant to answer a narrower question: what signals the installed extension stack appears to collect and transmit during realistic passive browsing, and which of those signals are likely relevant to Similarweb-style traffic intelligence even when they are sent indirectly.

## Goals

- Capture outbound browser traffic from the exact extensions currently installed in a MostLogin profile.
- Preserve the runtime shape of the real experiment by keeping all installed extensions enabled together.
- Use passive browsing only: homepage, pricing, legal, and footer navigation.
- Persist a full-fidelity event log with request details and readable response samples where feasible.
- Generate a derived signal map that separates direct observation from inference.
- Make Similarweb-relevant signals legible even when attribution is indirect or routed through shared analytics infrastructure.

## Non-Goals

- Do not change the Railway Similarweb-only experiment lane.
- Do not mirror the full MostLogin extension inventory into Railway.
- Do not disable extensions one-by-one during phase 1.
- Do not automate search-heavy browsing, popup interaction, or options-page interaction in phase 1.
- Do not require a complete MostLogin API for installed-extension export before producing useful results.

## Scope

Phase 1 targets the SEO and market-research cluster that matters to the Similarweb question:

- Similarweb
- MozBar
- Ahrefs SEO Toolbar
- Keywords Everywhere
- Wappalyzer
- BuiltWith

The workflow must operate against the exact extensions installed in the chosen MostLogin profile. It may observe more extensions if the live profile contains them, but the reporting should highlight this target set first.

## User Flow

1. The operator chooses a MostLogin profile ID or lets the tool read one from environment.
2. The tool opens the profile through the existing MostLogin CDP bridge.
3. The tool snapshots the live extension environment before browsing begins.
4. The tool attaches a broad network recorder to the live browser context.
5. The tool runs passive flows against the configured site profile.
6. The tool closes the profile cleanly through MostLogin APIs.
7. The tool synthesizes raw and derived artifacts into a timestamped analysis directory.
8. The operator reads a markdown report that explains what was observed and what is only inferred.

## Architecture

### 1. Live Capture Runner

The runner should reuse the existing MostLogin connection path in [src/browser.ts](/Users/wysmyfree/Projects/marketingbot/src/browser.ts:64) and passive site flows already used by [src/index.mostlogin.ts](/Users/wysmyfree/Projects/marketingbot/src/index.mostlogin.ts:1).

Responsibilities:

- open the real MostLogin profile
- create or reuse a Playwright page/context
- discover the active extension inventory through browser-accessible signals
- run passive browsing flows
- ensure the profile is closed through MostLogin rather than only via CDP

This runner lives outside the Railway experiment path and should be invoked by a dedicated script.

### 2. Full-Fidelity Traffic Recorder

The current [src/observability/networkDebug.ts](/Users/wysmyfree/Projects/marketingbot/src/observability/networkDebug.ts:1) is too narrow because it only logs known reporting endpoints. Phase 1 needs a separate recorder that captures all outbound traffic first and classifies later.

Responsibilities:

- listen to request, response, and failure events
- capture request URL, method, headers, post body, frame URL, resource type, and timing
- capture response status, headers, content type, and readable body previews when practical
- suppress binary body capture for obviously large non-text resources while still recording metadata
- write append-only JSONL so long runs remain debuggable

The recorder must prefer correctness and completeness over filtering.

### 3. Extension Inventory Snapshotter

MostLogin’s current public API surface in this repo exposes profile open/detail operations, but not an obvious installed-extension export endpoint. The design therefore treats extension snapshotting as layered:

- primary: discover installed extensions from the live Chromium session
- secondary: recover local extension bundle paths from profile storage if available
- tertiary: if bundle extraction is partial, still emit the live inventory and mark static evidence as incomplete

The workflow should not fail just because filesystem-level extraction is partial. Network capture is the primary artifact.

### 4. Static Bundle Inspector

When local extension bundle paths are recoverable, inspect:

- manifest name and version
- extension ID
- permissions
- host permissions
- background/service worker entry points
- obvious network endpoints and analytics libraries

This static evidence improves attribution but is not required for the capture run to succeed.

### 5. Signal Map Synthesizer

Post-process the raw JSONL into grouped outputs that answer:

- what hosts were contacted
- what paths and methods repeated
- what payload fields appeared repeatedly
- whether the payload appeared to include page URL, referrer, page title, timing, identity, or encoded blobs
- which extensions are the most plausible owners
- which traffic patterns seem most relevant to Similarweb-like ranking or market-intelligence collection

The synthesizer is responsible for conservative attribution language.

## Output Artifacts

Each run should write to a timestamped directory such as:

`./.analysis/extensions/<timestamp>-<profile-id>/`

Required artifacts:

### `capture.jsonl`

Append-only event stream with one JSON document per line. Event types should include:

- `request`
- `response`
- `requestfailed`
- `run-summary`

Fields should include:

- timestamp
- run ID
- profile ID
- current page URL
- request URL
- method
- request headers
- request body text when readable
- request body encoding hint when not readable
- response status
- response headers
- response content type
- response body preview when readable and below size cap
- resource type
- frame URL
- initiator hints where available

### `extensions.json`

Snapshot of the live extension environment:

- extension IDs
- names
- versions
- browser-detected metadata
- recovered local paths when available
- manifest permissions and host permissions when available
- static extraction status per extension

### `signal-map.json`

Derived machine-readable analysis:

- destination clusters by host
- path and method frequency
- recurring query keys and body keys
- content categories such as `page-url`, `referrer`, `page-metadata`, `timing`, `identity-token`, `opaque-encoded`, `analytics`
- attribution confidence
- Similarweb-relevance notes

### `REPORT.md`

Human-readable report with:

- run configuration
- target site and flows
- extension inventory snapshot
- top outbound hosts
- notable payload patterns
- per-extension notes
- Similarweb-focused interpretation
- confirmed vs inferred findings
- gaps and recommended follow-up work

CSV is not required in phase 1 because JSONL and markdown are better suited to forensic inspection.

## Attribution Model

Attribution must be explicit and conservative.

Categories:

- `direct`: browser evidence clearly ties the request to a specific extension context or extension-owned runtime
- `probable`: static bundle evidence plus observed endpoints strongly suggest one extension
- `shared-runtime`: request was observed during the run but ownership is ambiguous because all extensions were enabled together
- `inferred-signal`: the payload shape strongly suggests traffic-intelligence collection, but ownership or downstream consumer is not proven

The markdown report must visually separate:

- observed facts
- static bundle evidence
- analytical inference

This distinction is core to the value of the workflow.

## Data Handling Rules

Phase 1 uses full-fidelity capture.

That means:

- keep full request URLs
- keep full request headers
- keep readable request bodies in full
- keep readable response previews in full up to a bounded size

Guardrails:

- skip or truncate obviously large binary response bodies
- mark truncation explicitly in the artifact
- do not drop metadata for skipped bodies

The point is to maximize forensic usefulness without producing unusable artifact volume.

## Passive Browsing Contract

Phase 1 browsing is intentionally narrow:

- homepage
- pricing
- legal/footer links

It must not include:

- search-engine queries
- extension popup interaction
- options-page interaction
- login-dependent flows

The capture should mirror the existing low-friction browsing style already used by the MostLogin runner so the extension stack sees realistic passive traffic.

## Failure Handling

The run should fail hard when:

- the MostLogin profile cannot be opened
- no browser page/context can be attached
- browsing flows cannot start at all

The run should continue with warnings when:

- extension inventory extraction is partial
- static bundle recovery is incomplete
- some response bodies cannot be decoded
- some requests fail due to normal network conditions

The final report must contain a `Limitations` section summarizing any degraded evidence.

## Configuration

Expected environment inputs:

- `ML_PROFILE_IDS` or a dedicated analysis profile ID env
- existing MostLogin client configuration already used by the repo
- site profile selection already used by passive flows

New environment inputs may be added for:

- analysis output directory override
- response body size cap
- optional host include/exclude filters for report generation

Defaults should favor a one-command local run.

## File-Level Design

The implementation should stay modular and avoid overloading existing runtime files.

Planned units:

- `src/observability/extensionCapture.ts`
  Purpose: raw browser/CDP capture and JSONL writing
- `src/observability/extensionInventory.ts`
  Purpose: live extension inventory discovery and optional local bundle recovery
- `src/observability/extensionSignalMap.ts`
  Purpose: signal grouping, classification, and report synthesis
- `src/scripts/captureMostLoginExtensionSignals.ts`
  Purpose: orchestration entry point for the local analysis lane
- `tests/observability/extensionCapture.test.ts`
  Purpose: request/response recording and truncation behavior
- `tests/observability/extensionInventory.test.ts`
  Purpose: extension snapshot normalization and partial extraction handling
- `tests/observability/extensionSignalMap.test.ts`
  Purpose: classification and attribution bucketing

Existing files such as [src/index.mostlogin.ts](/Users/wysmyfree/Projects/marketingbot/src/index.mostlogin.ts:1) should be reused for flow behavior where possible, but the new lane should not be welded into the production runner.

## Testing Strategy

### Unit Tests

- recorder captures request and response metadata
- recorder truncates oversized text bodies with explicit markers
- binary responses retain metadata without full body capture
- inventory snapshot handles partial or missing extension bundle recovery
- signal map groups repeated hosts, paths, and keys correctly
- attribution categories remain stable for representative examples

### Local Smoke Test

Run against one real MostLogin profile with the live installed extension stack and passive browsing only.

Success looks like:

- analysis directory created
- `capture.jsonl` populated with outbound traffic
- `extensions.json` contains at least a usable live extension snapshot
- `REPORT.md` clearly summarizes confirmed and inferred signals

## Success Criteria

Phase 1 is successful when:

- we can run the workflow locally against a real MostLogin profile
- all currently installed extensions remain enabled together during capture
- passive browsing completes without forcing search or login flows
- raw artifacts preserve full-fidelity readable request data
- the report explains what signals appear to be collected and transmitted
- Similarweb-relevant traffic is called out even when it is indirect or not sent to an obvious Similarweb host

## Risks And Trade-Offs

- running all extensions together preserves realism but weakens attribution certainty
- MostLogin may not expose enough API surface for perfect local bundle extraction
- some extensions may communicate through shared analytics or proxy infrastructure that hides final ownership
- full-fidelity capture may produce large artifacts if response-body rules are too permissive

These trade-offs are acceptable in phase 1 because the main goal is high-fidelity observation, not courtroom-grade attribution.

## Follow-Up Work Explicitly Deferred

- one-extension-at-a-time isolation runs
- search-driven stimulation
- popup/options interaction
- direct comparison between MostLogin local stack and Railway pinned stack
- automated external Similarweb ranking validation
