# CloakBrowser-Manager Integration Plan

## Goal
Integrate CloakBrowser-Manager (CBM) as the browser backend for the marketing bot. Each bot session connects to a persistent CBM profile via CDP — giving each profile unique fingerprint, persistent cache, cookies, and Similarweb extension state across sessions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard (dashboard.wysmyfree.com/marketingbot)           │
│  - Instances page: profile list, state, traffic stats       │
│  - Controls: start/stop/rotate profiles                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│  CloakBrowser-Manager (separate Railway service)            │
│  - FastAPI + React, SQLite, auto-launch                     │
│  - Profile CRUD, CDP/VNC endpoints                          │
│  - 512MB RAM per running profile                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ CDP (Playwright connectOverCDP)
┌──────────────────────────▼──────────────────────────────────┐
│  MarketingBot Runner (existing service, modified)           │
│  - Connects to CBM profiles via CDP                         │
│  - Runs warmup → similarweb → browseHomepage flows          │
│  - Tracks traffic per profile                               │
└─────────────────────────────────────────────────────────────┘
```

## Why Separate Branch + Service?

- **Separate branch** (`feature/cloakbrowser-integration`): CBM integration changes are large and experimental
- **Separate Railway service**: CBM is a standalone Docker container with its own persistent volume, API, and frontend
- **No merge to main until validated**: Current Patchright setup keeps running on main

## Implementation Steps

### Step 1: Deploy CBM on Railway (no code changes to marketingbot yet)
- [ ] Create new Railway service from `CloakHQ/CloakBrowser-Manager` repo (or Dockerfile build)
- [ ] Configure: `AUTH_TOKEN`, persistent volume at `/data`, 512MB+ RAM
- [ ] Set `CBM_CONCURRENCY=2` (matching current bot concurrency)
- [ ] Verify: `GET /api/status` returns 200, frontend loads at configured URL
- [ ] Note the CBM URL (e.g., `https://cbm-production.up.railway.app`)

### Step 2: Create CBM Profiles via API
- [ ] `POST /api/profiles` × 2 (one per bot runner slot)
  - Unique `fingerprint_seed` per profile
  - Assign DataImpulse sticky proxy credentials
  - Set timezone/locale/user-agent matching proxy geolocation
- [ ] `POST /api/profiles/{id}/start` × 2 (auto-launch)
- [ ] Verify profiles are running: `GET /api/profiles` shows `status: running`
- [ ] Note profile IDs and CDP URLs

### Step 3: Add CDP Connection Mode to Marketing Bot
- [ ] Add env vars: `CBM_URL`, `CBM_AUTH_TOKEN`, `CBM_PROFILE_IDS` (comma-sep)
- [ ] Add new runner mode `cdp-remote` in `src/index.patchright.ts`:
  - If `CBM_URL` set → `chromium.connectOverCDP(cbm_cdp_url)` instead of `launchPersistentContext`
  - Maps `profile.id` → CBM profile ID for CDP connection
- [ ] Keep existing Patchright mode as fallback (env var gated)
- [ ] Test: bot connects to CBM profile, navigates, Similarweb extension loads

### Step 4: Dashboard Instances Page
- [ ] New route: `/instances` in dashboard
- [ ] Poll CBM `GET /api/profiles` every 5s
- [ ] Show: profile name, status (idle/active/error), uptime, proxy IP, traffic
- [ ] Controls: start/stop profile, force-rotate
- [ ] Map CBM profile state to existing session telemetry

### Step 5: Validate Similarweb Integration
- [ ] Verify Similarweb extension loads in CBM profile (check CBM frontend → extensions)
- [ ] Verify extension cache persists across bot sessions (localStorage survives)
- [ ] Monitor Similarweb data for target domain after 24h of running

## Key Differences from Current Setup

| Aspect | Current (Patchright) | New (CBM) |
|--------|---------------------|-----------|
| Browser | Stock Chromium + extensions | CloakBrowser (32 anti-detect patches) |
| Profile persistence | Manual userDataDir | Built-in, SQLite-tracked |
| Fingerprint | Fixed per profile | Fully randomized per profile |
| State visibility | Logs only | Full API: list, start, stop, inspect |
| Similarweb cache | Partial (file-based) | Full (profile persists in Docker) |
| Resource overhead | ~800MB RSS per runner | ~512MB per CBM profile |
| Bot connects via | `launchPersistentContext` | `connectOverCDP` to existing profile |

## Risks & Mitigations
- **CBM is early alpha** → pin to specific commit hash, test locally first
- **512MB/profile RAM** → start with 2 profiles, don't scale until validated
- **CDP stability** → CBM already handles CDP port rotation; add retry logic
- **Extension compatibility** → CBM uses Chromium; Similarweb extension should work via `--load-extension`
- **Separate service cost** → CBM runs as its own Railway service (~$5-15/mo)

## Rollback Plan
- Set `CBM_URL` env var to empty → bot falls back to current Patchright mode
- Stop CBM service → no impact on running bot
- Delete branch if abandoned → no merge to main means zero blast radius
