# Hermes WebUI integration

Hermes is served at `/hermes/` through the dashboard service. The WebUI service
has no public domain: it is only reachable over Railway private networking, and
the dashboard applies its existing GitHub OAuth gate before proxying the request.

## Railway service contract

The `hermes-webui` service is built from [`../hermes/Dockerfile`](../hermes/Dockerfile),
which layers a Railway-environment compatibility guard over the official
`ghcr.io/nesquena/hermes-webui` image. It has a persistent volume mounted at
`/data` and these values:

```text
HERMES_HOME=/data/hermes
HERMES_WEBUI_STATE_DIR=/data/webui
HERMES_WEBUI_DEFAULT_WORKSPACE=/data/workspace
HERMES_WEBUI_CHAT_BACKEND=gateway
HERMES_WEBUI_GATEWAY_BASE_URL=http://hermes-gateway.railway.internal:8642
HERMES_WEBUI_GATEWAY_API_KEY=${{hermes-gateway.API_SERVER_KEY}}
HERMES_WEBUI_SKIP_ONBOARDING=1
HERMES_WEBUI_HOST=0.0.0.0
HERMES_WEBUI_PORT=8787
PORT=8787
```

The dashboard requires `HERMES_WEBUI_URL=http://hermes-webui.railway.internal:8787`.
Keep the gateway key as a Railway reference rather than copying its value.
