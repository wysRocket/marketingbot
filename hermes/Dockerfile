FROM ghcr.io/nesquena/hermes-webui:latest

# Railway services cannot share the Gateway container's filesystem. Add the
# matching open-source agent tree so WebUI can discover its agent APIs and show
# an accurate System status, while gateway mode still owns execution.
RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /opt/hermes
ENV HERMES_WEBUI_AGENT_DIR=/opt/hermes

# Add a stable dashboard return link to every proxied Hermes page. The absolute
# root target resolves to dashboard.wysmyfree.com rather than the Hermes path.
COPY marketingbot-nav.js /tmp/marketingbot-nav.js
RUN index="$(find / -type f -path '*/static/index.html' -print -quit)" \
    && test -n "$index" \
    && static_dir="$(dirname "$index")" \
    && cp /tmp/marketingbot-nav.js "$static_dir/marketingbot-nav.js" \
    && sed -i 's|</head>|<script src="static/marketingbot-nav.js?v=1"></script></head>|' "$index" \
    && rm /tmp/marketingbot-nav.js

# Railway can inject shell-function environment records whose names are not
# valid Bash identifiers. Hermes' upstream startup script reloads its saved
# environment after dropping privileges; validate a record immediately before
# Bash dereferences its key. This preserves all legitimate app variables while
# safely discarding only malformed records.
RUN sed -i '164i\      [[ "$key" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || continue' /hermeswebui_init.bash
