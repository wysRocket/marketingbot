FROM ghcr.io/nesquena/hermes-webui:latest

# Railway can inject shell-function environment records whose names are not
# valid Bash identifiers. Hermes' upstream startup script reloads its saved
# environment after dropping privileges; ignore only those malformed records
# so valid application variables and secret references still pass through.
RUN sed -i '/rvalue=$value/a\      [[ "$key" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || continue' /hermeswebui_init.bash
