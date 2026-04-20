# MostLogin Bridge on macOS with `launchd`

This setup keeps the local MostLogin bridge alive across terminal restarts and reboots.

It manages two user LaunchAgents:

- `com.marketingbot.mostlogin-tunnel-proxy`
- `com.marketingbot.mostlogin-cloudflared`

## Files in this repo

- env example: [.mostlogin-bridge.env.example](/Users/wysmyfree/Projects/marketingbot/.mostlogin-bridge.env.example)
- proxy runner: [scripts/run-mostlogin-tunnel-proxy.sh](/Users/wysmyfree/Projects/marketingbot/scripts/run-mostlogin-tunnel-proxy.sh)
- Cloudflare runner: [scripts/run-mostlogin-cloudflared.sh](/Users/wysmyfree/Projects/marketingbot/scripts/run-mostlogin-cloudflared.sh)
- installer: [scripts/install-mostlogin-bridge-launchd.sh](/Users/wysmyfree/Projects/marketingbot/scripts/install-mostlogin-bridge-launchd.sh)
- plist templates:
  - [ops/launchd/com.marketingbot.mostlogin-tunnel-proxy.plist.template](/Users/wysmyfree/Projects/marketingbot/ops/launchd/com.marketingbot.mostlogin-tunnel-proxy.plist.template)
  - [ops/launchd/com.marketingbot.mostlogin-cloudflared.plist.template](/Users/wysmyfree/Projects/marketingbot/ops/launchd/com.marketingbot.mostlogin-cloudflared.plist.template)

## 1. Prepare the local env file

Create a local env file from the example:

```bash
cp .mostlogin-bridge.env.example .mostlogin-bridge.env
```

Fill in:

- `MOSTLOGIN_API_KEY`
- `MOSTLOGIN_TUNNEL_BEARER`
- `MOSTLOGIN_CLOUDFLARED_TUNNEL`
- `MOSTLOGIN_CLOUDFLARED_CONFIG`

Defaults already match the current local bridge:

- `MOSTLOGIN_HOST=127.0.0.1:30898`
- `MOSTLOGIN_TUNNEL_PORT=30908`

`.mostlogin-bridge.env` is gitignored.

## 2. Create the named Cloudflare config

Start from [docs/mostlogin-cloudflared.example.yml](/Users/wysmyfree/Projects/marketingbot/docs/mostlogin-cloudflared.example.yml) and create a real config file outside the repo or under your user Cloudflare directory.

Typical flow:

```bash
cp docs/mostlogin-cloudflared.example.yml ~/.cloudflared/mostlogin-cloudflared.yml
```

Then replace:

- tunnel id
- credentials file path
- hostname

The config should point traffic to `http://127.0.0.1:30908`.

## 3. Install the LaunchAgents

From the repo root:

```bash
npm run bridge:install:launchd
```

Or pass a custom env file path:

```bash
bash scripts/install-mostlogin-bridge-launchd.sh /absolute/path/to/.mostlogin-bridge.env
```

The installer:

- validates `npm`, `cloudflared`, and required env values
- renders the plist templates into `~/Library/LaunchAgents`
- bootstraps both agents
- kickstarts them immediately

## 4. Check agent health

```bash
launchctl print gui/$(id -u)/com.marketingbot.mostlogin-tunnel-proxy
launchctl print gui/$(id -u)/com.marketingbot.mostlogin-cloudflared
```

Logs are written to:

```bash
~/Library/Logs/marketingbot/mostlogin-tunnel-proxy.stdout.log
~/Library/Logs/marketingbot/mostlogin-tunnel-proxy.stderr.log
~/Library/Logs/marketingbot/mostlogin-cloudflared.stdout.log
~/Library/Logs/marketingbot/mostlogin-cloudflared.stderr.log
```

## 5. Validate the public bridge

Once both agents are running:

```bash
curl -sS -X POST https://mostlogin.example.com/api/profile/getProfiles \
  -H 'Content-Type: application/json' \
  -H 'X-Tunnel-Bearer: replace_me' \
  --data '{"page":1,"pageSize":1}'
```

You want an HTTP 200 response and a non-empty `list`.

MostLogin itself still needs to be running locally and logged in. The LaunchAgents keep the proxy and `cloudflared` alive, but they cannot revive the desktop API if the MostLogin app is closed.

## 6. Point Railway at the bridge

```bash
railway variable set \
  MOSTLOGIN_TUNNEL_URL=https://mostlogin.example.com \
  MOSTLOGIN_TUNNEL_BEARER=replace_me
```

At that point the Railway smoke lane no longer depends on an interactive terminal session.
