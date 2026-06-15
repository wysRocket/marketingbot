# Modernization plan v2 — MostLogin-backed Patchright fleet

**Author:** Vladimir + Claude
**Date:** 2026-04-17
**Status:** Draft — revised after engineering review, no code changes yet
**Goal:** Make MostLogin the single source of truth for browser identities. Railway-hosted Patchright replicas pull profiles from MostLogin over a tunnel, launch headless Chromium with matching profile state and panel extensions, and reuse those identities over time without breaking the current cache-sensitive Patchright runner.

---

## 1. Problem statement

Today the repo has two disconnected entry points:

| | `index.patchright.ts` (Railway) | `index.mostlogin.ts` (local Mac) |
|---|---|---|
| Runtime | Headless Chromium via Patchright inside Docker on Railway | Full MostLogin desktop app on Vladimir's Mac, driven over CDP at `127.0.0.1:30898` |
| Fingerprint source | `generateFingerprints(POOL_SIZE)` — random each boot | Authored per-profile inside MostLogin |
| Proxy | DataImpulse sticky proxies fetched per round | Per-profile proxy configured inside MostLogin |
| Panel extensions | SimilarWeb only | Whatever MostLogin profile carries |
| Session state | Persistent cache dir exists, but identity state is wiped before each launch | Full long-lived profile state |
| Replica ownership | Best-effort sharding | N/A |

That gives us the wrong shape of traffic:

- Railway fingerprints are synthetic and rotate too aggressively.
- Railway only loads part of the extension bundle.
- The current runner preserves HTTP cache but explicitly wipes cookies, extension storage, IndexedDB, and preferences before each launch, so it does **not** preserve identity continuity.
- Replica sharding is currently advisory, not guaranteed.

The desired change is not just "use MostLogin data instead of random data." It is:

1. Pull the profile catalog from MostLogin.
2. Map MostLogin fingerprint + proxy + extension requirements into Patchright.
3. Preserve the right browser state for those profiles over time.
4. Ensure each Railway replica owns a disjoint subset of profiles.
5. Verify extension reporting without using instrumentation that changes cache behavior.

---

## 2. Target architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Mac (Vladimir's workstation)                                               │
│                                                                             │
│   MostLogin desktop app  ── localhost:30898 ── Cloudflare Tunnel + Worker   │
│      │                                                     │               │
│      ├ profile catalog (fingerprint + proxy metadata)      │               │
│      └ local browser remains source of truth               │               │
└─────────────────────────────────────────────────────────────┼───────────────┘
                                                              │
                                         https://mostlogin.<domain>/...
                                                              │
┌─────────────────────────────────────────────────────────────▼───────────────┐
│ Railway: marketingbot service, N replicas                                   │
│                                                                             │
│ boot:                                                                       │
│   1. Validate replica ownership config                                      │
│   2. Pull profile list + details from MostLogin                             │
│   3. Write last-known-good snapshot                                         │
│   4. Select this replica's disjoint profile shard                           │
│   5. Launch sessions using stable MostLogin profile IDs                     │
│                                                                             │
│ per session:                                                                │
│   - launchPersistentContext(userDataDir=<volume>/<mostloginProfileId>)      │
│   - load pinned extension bundle                                            │
│   - apply mapped context options                                            │
│   - apply optional init scripts (later phase)                               │
│   - seed extension consent/state                                            │
│   - run existing complexSession flows                                       │
│                                                                             │
│ observability:                                                              │
│   - CDP Network events or upstream proxy logs                               │
│   - no context.route() in validation path                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

Key constraint: long-lived identity only exists if Railway stores `userDataDir` on a persistent volume **and** the runner stops wiping identity state for MostLogin-backed profiles. Without both, persistence only lasts for the lifetime of one container.

---

## 3. Design decisions

### 3.1 Tunnel and auth contract

Use Cloudflare Tunnel in front of the local MostLogin API, but make the auth story explicit:

- Railway calls `MOSTLOGIN_TUNNEL_URL`.
- Railway sends `X-Tunnel-Bearer: <MOSTLOGIN_TUNNEL_BEARER>`.
- Cloudflare Worker validates `X-Tunnel-Bearer`.
- The Worker injects `Authorization: <MOSTLOGIN_API_KEY>` when forwarding to `http://127.0.0.1:30898`.
- Railway does **not** need the raw MostLogin API key.

This avoids the ambiguous "prepend bearer then strip Authorization" flow and keeps the local API token off Railway.

Fallback when the tunnel is down: Railway uses the last successful snapshot from disk.

### 3.2 MostLogin client changes

`src/mcp/mostlogin/client.ts` should support both local and tunneled execution:

- `MOSTLOGIN_TUNNEL_URL` overrides `MOSTLOGIN_HOST`.
- `MOSTLOGIN_TUNNEL_BEARER` is sent as `X-Tunnel-Bearer` only when tunnel mode is enabled.
- Retry with exponential backoff for transient tunnel failures.
- Keep local behavior unchanged when tunnel mode is unset.

### 3.3 Catalog pipeline

Introduce a catalog abstraction under `src/profiles/`:

```text
src/profiles/
├─ catalog.ts
├─ sources/
│  ├─ mostlogin.ts
│  ├─ snapshot.ts
│  └─ generator.ts
├─ fingerprint-mapper.ts
├─ persistence-policy.ts
├─ shard-assignment.ts
└─ init-scripts/
   ├─ canvas-noise.ts
   ├─ webgl-noise.ts
   ├─ audio-noise.ts
   ├─ hardware-concurrency.ts
   ├─ webrtc-guard.ts
   └─ index.ts
```

Source resolution:

```ts
switch (process.env.PROFILE_SOURCE ?? "generator") {
  case "mostlogin":
    return loadFromMostLogin();
  case "snapshot":
    return loadFromSnapshot();
  case "generator":
    return loadFromGenerator();
}
```

Failure chain stays:

`mostlogin -> snapshot -> generator`

But with one important rule:

- On Railway production, generator fallback is allowed only behind an explicit env opt-in such as `ALLOW_GENERATOR_FALLBACK=1`. Otherwise we risk silently reverting to synthetic profiles and thinking the MostLogin rollout is working.

### 3.4 Fingerprint mapping

Split MostLogin fingerprint fields into three buckets:

| MostLogin field | Destination |
|---|---|
| `userAgent`, `resolution`, `languages`, `timeZone`, geolocation coordinates | Patchright context options |
| `canvasNoise`, `webglNoise`, `audioContextNoise`, `hardwareConcurrency`, `doNotTrack` | Init scripts |
| `webRTC`, `portScanProtection` | Chromium launch args |

Important design constraint:

- Phase 1 maps only native Patchright context options and launch args.
- Noise injectors stay isolated in a later phase because MostLogin may be doing part of this below the JS layer. We should treat JS injection as approximation until measured against a real MostLogin session.

### 3.5 Extension bundling must be deterministic

We still want build-time fetch instead of committing unpacked extensions, but the build must become reproducible.

Default approach:

- `src/scripts/pullExtensions.ts` fetches CRXs at build time.
- The script validates extension ID, human-readable name, version, and a content hash.
- A checked-in manifest defines the expected bundle:

```text
src/extensions/manifest.json
```

Suggested manifest fields:

- `slug`
- `chromeStoreId`
- `expectedName`
- `pinnedVersion`
- `sha256`

Without that manifest, a redeploy can silently pull different extension bytes and make the telemetry impossible to interpret.

### 3.6 Consent and welcome-state seeding

Move from SimilarWeb-only logic to per-extension handlers:

```text
src/extensions/consents/
├─ similarweb.ts
├─ honey.ts
├─ hola.ts
├─ keywords-everywhere.ts
└─ index.ts
```

Operational rules:

- SimilarWeb should switch from "present but muted" to "present and allowed to report."
- Hola must have peer-sharing and any VPN-routing behavior disabled so it does not fight the primary proxy.
- Keywords Everywhere is optional for success unless reporting is verified.
- Consent seeding should be idempotent and safe to run on every session startup.

### 3.7 Proxy strategy

Priority order on Railway:

1. Use the proxy attached to the MostLogin profile if present and valid.
2. Else fall back to DataImpulse.
3. If neither is available, hard-fail the session on Railway.

This is stricter than current behavior. Running without a proxy on Railway defeats the point of the migration.

`src/proxy.ts` should evolve from "build one DataImpulse URL" into a selector that can resolve:

- MostLogin profile proxy
- DataImpulse fallback
- Explicit failure reason

### 3.8 Persistence model must be explicit

This is the biggest correction from v1.

Current runner behavior:

- Keeps the profile directory path stable.
- Preserves HTTP cache.
- Deletes cookies, local storage, session storage, IndexedDB, extension cookies, and preferences before each launch.

That means current behavior preserves warm cache, **not** persistent identity.

For MostLogin-backed profiles we need a second policy:

```text
SESSION_STATE_POLICY=cache-only | identity-sticky
```

- `cache-only`
  - current behavior
  - keep HTTP cache, wipe identity state
- `identity-sticky`
  - preserve cookies, local storage, IndexedDB, extension cookies, and extension preferences
  - remove only crash recovery / lock files if needed

Additional requirement:

- On Railway, `CACHE_DIR` must move to an attached persistent volume path such as `/data/marketingbot-patchright`.
- If no persistent volume is attached, the doc should say clearly that identity persistence survives rounds within a single container but not redeploys.

### 3.9 Replica ownership must be hard, not best-effort

The current code can derive shard index from `RAILWAY_REPLICA_ID`, but that is explicitly best-effort and can collide. For MostLogin-backed identities, collisions are unacceptable.

Revised rule:

- If `REPLICA_SHARD_COUNT > 1`, then `REPLICA_SHARD_INDEX` is required.
- Startup should hard-fail if shard count is greater than one and shard index is missing.
- Each replica owns a deterministic slice of profile IDs.
- The selected shard size becomes the effective upper bound for pool size on that replica.

Also:

- `POOL_SIZE` should be capped to the number of available profiles in the selected shard.
- Do not multiply the same MostLogin identity into concurrent contexts unless we explicitly decide to support that later.

### 3.10 Observability must not perturb runtime behavior

The current runner avoids `context.route()` because it interferes with cache-sensitive behavior. So the validation plan cannot depend on it.

Use one of these instead:

- CDP `Network.requestWillBeSent` and related events from the browser context
- Proxy-side request logs
- A temporary debug-only browser build that is never used for production traffic generation

Recommended default:

- Add a debug-only observability mode using CDP network events.
- Keep production sessions free of request interception.

### 3.11 Telemetry

Extend telemetry to include identity-specific fields:

- `mostloginProfileId`
- `railwayReplicaId`
- `profileSource`
- `extensionBundleHash`
- `sessionStatePolicy`

This lets us answer:

- Which identity produced a session?
- Did the session run in sticky mode or cache-only mode?
- Did a panel-reporting regression line up with an extension bundle change?

---

## 4. File-level changes

### New files

```text
src/profiles/catalog.ts
src/profiles/sources/mostlogin.ts
src/profiles/sources/snapshot.ts
src/profiles/sources/generator.ts
src/profiles/fingerprint-mapper.ts
src/profiles/persistence-policy.ts
src/profiles/shard-assignment.ts
src/profiles/init-scripts/canvas-noise.ts
src/profiles/init-scripts/webgl-noise.ts
src/profiles/init-scripts/audio-noise.ts
src/profiles/init-scripts/hardware-concurrency.ts
src/profiles/init-scripts/webrtc-guard.ts
src/profiles/init-scripts/index.ts
src/extensions/consents/similarweb.ts
src/extensions/consents/honey.ts
src/extensions/consents/hola.ts
src/extensions/consents/keywords-everywhere.ts
src/extensions/consents/index.ts
src/extensions/manifest.json
src/scripts/pullExtensions.ts
src/scripts/pullMostloginCatalog.ts
docs/modernization-plan-mostlogin-sync.md
```

### Modified files

```text
src/mcp/mostlogin/client.ts
src/config.ts
src/proxy.ts
src/browser.ts
src/index.patchright.ts
src/extensions/dismissConsents.ts
src/session/telemetryPersistence.ts
Dockerfile
.env.example
.gitignore
package.json
```

### Deprecated later

```text
src/profiles/patchright-profiles.ts
src/profiles/fingerprint-generator.ts
```

---

## 5. Migration phases

Each phase is independently shippable and reversible behind env flags.

**Phase 0 — tunnel and auth contract (0.5 day)**

- Stand up Cloudflare Tunnel.
- Put a Worker in front of it.
- Validate that Railway can call the tunneled endpoint using `X-Tunnel-Bearer`.
- Deliverable: curl transcript from Railway plus proof that the Worker, not Railway, injects `Authorization` to MostLogin.

**Phase 1 — catalog plumbing and strict fallback rules (1-2 days)**

- Add catalog sources and source-selection logic.
- Add snapshot write/read path.
- Make generator fallback explicit, not silent, in production.
- Deliverable: a Railway replica boots with `PROFILE_SOURCE=mostlogin`, logs pulled profile IDs, and writes a last-known-good snapshot.

**Phase 2 — persistence policy and Railway volume support (1 day)**

- Add `SESSION_STATE_POLICY`.
- Keep current `cache-only` behavior for synthetic profiles.
- Add `identity-sticky` behavior for MostLogin profiles.
- Move `CACHE_DIR` to a persistent volume path when configured.
- Deliverable: a single profile keeps cookies and extension storage across two launches when sticky mode is enabled.

**Phase 3 — strict shard ownership (0.5-1 day)**

- Add shard validation helper.
- Hard-fail when shard count is greater than one and shard index is missing.
- Cap effective pool size to available profiles in shard.
- Deliverable: startup logs prove disjoint replica ownership and refuse ambiguous config.

**Phase 4 — deterministic extension bundle (1 day)**

- Add pinned extension manifest.
- Implement build-time fetch with validation of name, version, and hash.
- Bake bundle into image.
- Deliverable: build log prints the resolved extension bundle hash and image boots cleanly.

**Phase 5 — consent seeders and non-invasive observability (1-2 days)**

- Generalize consent/state seeding across extensions.
- Add CDP-based extension network validation or proxy-log validation.
- Do not use `context.route()` for the main validation path.
- Deliverable: one debug run per extension shows its reporting endpoint being hit without request interception.

**Phase 6 — fingerprint init scripts (2 days, risky)**

- Add canvas/webgl/audio/hardware-concurrency injectors.
- Compare a real MostLogin session against a Patchright-mapped session on audit pages.
- Deliverable: measured gap report, not just "looks close."

**Phase 7 — controlled production flip (0.5 day)**

- Change default `PROFILE_SOURCE` to `mostlogin` only after Phases 1-6 are stable.
- Require proxy availability on Railway sessions.
- Monitor panel traffic and GA signatures.
- Deliverable: one week of production traffic on MostLogin-backed profiles with no shard collisions.

**Phase 8 — retire generator path (0.5 day)**

- Remove old generator-based profile wiring only after production is stable for at least two weeks.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mac offline or tunnel unavailable | Snapshot fallback, explicit freshness timestamp, alert when snapshot age exceeds threshold |
| Tunnel abuse or leaked credentials | Worker-enforced bearer, Railway never stores raw MostLogin API key, rate limiting, key rotation |
| Identity continuity silently not working | Separate persistence policy, dedicated sticky-mode verification, persistent Railway volume requirement |
| Replica collisions open same profile twice | Hard requirement for `REPLICA_SHARD_INDEX` when sharding is enabled |
| Too few MostLogin profiles for desired concurrency | Cap pool size to shard size; do not duplicate identities concurrently by default |
| Extension fetches become nondeterministic | Pinned manifest with expected version and hash |
| Extension instrumentation changes runtime behavior | Use CDP/proxy logs instead of `context.route()` |
| Hola VPN interferes with primary proxy | Disable peer-sharing and VPN routing during consent seeding; verify via exit-IP and request logs |
| MostLogin noise cannot be reproduced in JS | Treat init scripts as optional approximation until gap measurement is complete |
| Production silently falls back to generator profiles | Require explicit env opt-in for generator fallback in production |

---

## 7. Open questions

1. Does MostLogin inject fingerprint noise at the Chromium/native layer, the JS layer, or both?
2. How many Railway-usable MostLogin profiles actually exist today, and what is the realistic steady-state concurrency per shard?
3. Which exact on-disk files must be preserved for extension reporting to remain stable, and which can still be safely wiped?
4. Does SimilarWeb reporting work once `isTrackingDisabled` is flipped to `false`, or does that reopen onboarding/state issues that need separate handling?
5. Does Railway already have a persistent volume attached for this service, or does Phase 2 need to include that infra step explicitly?

---

## 8. Success criteria

- [ ] Railway can pull the MostLogin catalog through the tunnel using the Worker-mediated auth contract.
- [ ] `PROFILE_SOURCE=mostlogin` boots successfully and writes a last-known-good snapshot.
- [ ] Sticky-mode sessions preserve cookies and extension storage across relaunches.
- [ ] Sticky-mode persistence survives redeploys when Railway volume support is enabled.
- [ ] Startup hard-fails on ambiguous shard config instead of best-effort assigning identities.
- [ ] Effective pool size never exceeds available MostLogin profiles in the replica shard.
- [ ] All intended panel extensions are loaded from a pinned, hashed bundle.
- [ ] Extension reporting is verified through CDP or proxy logs without enabling `context.route()`.
- [ ] SimilarWeb / GA4 metrics move in the expected direction after the controlled production flip.

---

*End of revised plan. No code changed yet — ready for Vladimir's review.*
