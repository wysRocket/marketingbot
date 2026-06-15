# Similarweb Traffic-Signal Rollout

## Phase 1 goal

Phase 1 is an instrumentation-first Railway lane for Similarweb traffic-signal experiments.

- Target site profile: `eurocookflow`
- Profile source baseline: `PROFILE_SOURCE=mostlogin`
- Railway extension baseline: `PATCHRIGHT_EXTENSION_SLUGS=similarweb`
- Primary success condition: clean anonymous browsing sessions with bundle-aware telemetry

This phase does **not** attempt full MostLogin extension mirroring. MostLogin remains the source of truth for identity, fingerprint, and proxy data, while Railway explicitly chooses a narrow extension bundle for experiment control.

## Runtime contract

- `PATCHRIGHT_EXTENSION_SLUGS`
  - Comma-separated allowlist of unpacked extension slugs from `.extensions`
  - Outside Railway, unset means "load all unpacked local extensions"
  - On Railway, unset defaults to `similarweb`
  - Unknown or missing slugs fail fast at startup

Patchright computes a deterministic extension bundle hash from the selected slug set plus the pinned manifest entries used for the run. That hash is emitted in logs and persisted in telemetry alongside `extensionSlugs`.

## Railway baseline

Use this lane for Phase 1 traffic-signal validation:

```bash
PROFILE_SOURCE=mostlogin
PATCHRIGHT_EXTENSION_SLUGS=similarweb
BOT_SITE_PROFILE=eurocookflow
```

Keep login optional for this phase. The proof lane should succeed on anonymous homepage, pricing, and legal/footer browsing without extension-related regressions.

## Operator workflow

1. Materialize the pinned extension bundle locally with `npm run pull:extensions` if `.extensions` is stale or missing.
2. Deploy the Railway worker with `PROFILE_SOURCE=mostlogin` and `PATCHRIGHT_EXTENSION_SLUGS=similarweb`.
3. Confirm startup logs show the expected lane:
   - target site profile
   - resolved profile source
   - selected extension slugs
   - extension bundle hash
   - shard profile IDs
4. Confirm each session writes telemetry with both `extensionBundleHash` and `extensionSlugs`.
5. Inspect session URLs, traffic counters, and warnings for extension-related regressions before scaling the lane.
6. Start external Similarweb rank or traffic observation only after the internal session and telemetry checks are stable.

## Railway smoke rollout

### Preflight

Before mutating Railway state:

```bash
railway login
railway whoami --json
railway status --json
```

You need the service already linked, or you need to pass `--service <service-name>` on the variable and log commands below.

### MostLogin bridge prerequisites

Railway cannot reach the desktop MostLogin API directly. The smoke lane therefore depends on a local bridge that stays online while Railway is running:

For a durable macOS setup, use the `launchd` runbook in [docs/mostlogin-bridge-launchd.md](/Users/wysmyfree/Projects/marketingbot/docs/mostlogin-bridge-launchd.md).

1. Start the authenticated local proxy against the desktop MostLogin API:

```bash
MOSTLOGIN_API_KEY=replace_me \
MOSTLOGIN_HOST=127.0.0.1:30898 \
MOSTLOGIN_TUNNEL_BEARER=replace_me \
MOSTLOGIN_TUNNEL_PORT=30908 \
npm run start:mostlogin:tunnel-proxy
```

2. Create a named `cloudflared` config from [mostlogin-cloudflared.example.yml](/Users/wysmyfree/Projects/marketingbot/docs/mostlogin-cloudflared.example.yml), then map a public hostname to the tunnel:

```bash
cloudflared tunnel route dns <tunnel-name> mostlogin.example.com
cloudflared tunnel --config /absolute/path/to/mostlogin-cloudflared.yml run <tunnel-name>
```

3. Point Railway at that bridge:

```bash
railway variable set \
  MOSTLOGIN_TUNNEL_URL=https://mostlogin.example.com \
  MOSTLOGIN_TUNNEL_BEARER=replace_me
```

4. Validate the tunnel before deploying Railway:

```bash
curl -sS -X POST https://mostlogin.example.com/api/profile/getProfiles \
  -H 'Content-Type: application/json' \
  -H 'X-Tunnel-Bearer: replace_me' \
  --data '{"page":1,"pageSize":1}'
```

The response should be HTTP 200 with a non-empty `list` payload. If the local proxy or `cloudflared` process dies, `PROFILE_SOURCE=mostlogin` on Railway will stop resolving profiles.

The upstream desktop app must also stay open and logged in. If MostLogin is not running locally, the bridge will stay up but return upstream connection failures.

### Required existing secrets

Keep these present on the Railway service before enabling the smoke lane:

- `MOSTLOGIN_TUNNEL_URL`
- `MOSTLOGIN_TUNNEL_BEARER`
- `DI_USER`
- `DI_PASS`

`MOSTLOGIN_TUNNEL_URL` and `MOSTLOGIN_TUNNEL_BEARER` are required for `PROFILE_SOURCE=mostlogin` on Railway. `DI_USER` and `DI_PASS` provide the fallback proxy pool; if both MostLogin and fallback proxy resolution fail, Railway sessions now fail fast instead of silently running direct.

### Recommended smoke variables

Apply the validated smoke lane variables:

```bash
railway variable set \
  PROFILE_SOURCE=mostlogin \
  PATCHRIGHT_EXTENSION_SLUGS=similarweb \
  BOT_SITE_PROFILE=eurocookflow \
  CONCURRENCY=1 \
  MIN_CONCURRENCY=1 \
  POOL_SIZE=1 \
  TOTAL_ROUNDS=1 \
  SESSION_TIMEOUT_MS=180000 \
  ROUND_TIMEOUT_MS=240000 \
  SESSION_LAUNCH_STAGGER_MS=0 \
  ALIVE_LOG_INTERVAL_MS=10000 \
  SKIP_IP_CHECK=1 \
  FLOW_MIN_DURATION_MS=10000 \
  FLOW_MIN_UNIQUE_PAGES=2 \
  FLOW_TOPUP_MAX_CYCLES=1
```

Optional but recommended when a persistent volume is attached:

```bash
railway variable set FLOW_TELEMETRY_DIR=/data/telemetry
```

### Deploy and verify

Deploy the worker:

```bash
railway up --detach -m "similarweb smoke lane"
```

Then verify with logs:

```bash
railway logs --lines 200
```

Look for these signals in the deployment logs:

- `profile-source=mostlogin`
- `selected=similarweb`
- the emitted `sha256:` extension bundle hash
- a non-empty profile list for the selected shard
- no proxy-resolution failure on Railway
- successful completion of `browseHomepage`, `explorePricing`, and `browseFooterLinks`

### Validated Railway reference run

The Phase 1 smoke lane has already been validated on Railway with this contract:

```bash
PROFILE_SOURCE=mostlogin
PATCHRIGHT_EXTENSION_SLUGS=similarweb
BOT_SITE_PROFILE=eurocookflow
```

Reference signals from the validated deployment on 2026-04-17:

- startup logged `profile-source=mostlogin`
- extension selection logged `selected=similarweb`
- bundle hash logged `sha256:7951ab32e5f86cb972f1a8e8d8515a90b70d94fb59f85b70f492b1a29f734771`
- fallback proxy pool logged `[proxy] fetched 1/1 proxies`
- the session completed in about `74s`
- telemetry-equivalent runtime summary logged `3 page(s)`, `13 interaction(s)`, and no warning indicators

Treat this as the baseline acceptance signal before widening concurrency or adding heavier browse policies.

## Controlled medium lane

Once the smoke lane is stable, the next safe step is a slightly heavier but still controlled Railway profile:

```bash
railway variable set \
  PROFILE_SOURCE=mostlogin \
  PATCHRIGHT_EXTENSION_SLUGS=similarweb \
  BOT_SITE_PROFILE=eurocookflow \
  CONCURRENCY=1 \
  MIN_CONCURRENCY=1 \
  POOL_SIZE=2 \
  TOTAL_ROUNDS=2 \
  SESSION_TIMEOUT_MS=420000 \
  ROUND_TIMEOUT_MS=540000 \
  SESSION_LAUNCH_STAGGER_MS=0 \
  ALIVE_LOG_INTERVAL_MS=10000 \
  SKIP_IP_CHECK=1 \
  FLOW_MIN_DURATION_MS=60000 \
  FLOW_MIN_UNIQUE_PAGES=4 \
  FLOW_TOPUP_MAX_CYCLES=3
```

Why this lane is still controlled:

- concurrency stays at `1`
- the extension bundle stays fixed at `similarweb`
- the identity source stays fixed at `mostlogin`
- only session depth and sequential session count increase

Reference activation from 2026-04-19:

- startup logged `pool: 2`
- startup logged `rounds: 2`
- startup kept `profile-source=mostlogin`
- startup kept `selected=similarweb`
- fallback proxy pool still logged `[proxy] fetched 1/1 proxies`

Use this lane before any concurrency increase. If warnings appear here, fix them before widening traffic volume.

If `FLOW_TELEMETRY_DIR=/data/telemetry` is configured on a persistent volume, confirm the JSONL/CSV output includes:

- `extensionBundleHash`
- `extensionSlugs`
- `profileSource=mostlogin`
- `warningsCount=0` for the smoke lane

## Validated local smoke

This repo has been smoke-validated locally with the Similarweb-only MostLogin lane using a shorter smoke policy:

```bash
PROFILE_SOURCE=mostlogin \
PATCHRIGHT_EXTENSION_SLUGS=similarweb \
BOT_SITE_PROFILE=eurocookflow \
POOL_SIZE=1 \
CONCURRENCY=1 \
MIN_CONCURRENCY=1 \
TOTAL_ROUNDS=1 \
SESSION_TIMEOUT_MS=180000 \
ROUND_TIMEOUT_MS=240000 \
SESSION_LAUNCH_STAGGER_MS=0 \
ALIVE_LOG_INTERVAL_MS=10000 \
SKIP_IP_CHECK=1 \
FLOW_MIN_DURATION_MS=10000 \
FLOW_MIN_UNIQUE_PAGES=2 \
FLOW_TOPUP_MAX_CYCLES=1 \
npx ts-node src/index.patchright.ts
```

Notes from the validated run:

- Startup resolved `profile-source=mostlogin`
- Extension selection resolved to `similarweb`
- Telemetry persisted both `extensionBundleHash` and `extensionSlugs`
- Anonymous homepage, pricing, and footer legal browsing completed successfully

The default session policy is intentionally much heavier than a smoke test. If you keep the default `minDurationMs=150000` and multiple top-up cycles, the run is valid for engagement simulation but slower than a practical pre-deploy smoke.

## Notes

- Railway extension loading is an explicit allowlist, not a mirror of the MostLogin UI.
- The pinned manifest at `src/extensions/manifest.json` remains the source of truth for available extension bundles.
- Railway proxy behavior stays strict: MostLogin proxy first, configured fallback second, and no silent direct-traffic fallback.
