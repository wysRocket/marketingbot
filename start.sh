#!/bin/bash
# Service-aware start dispatcher
SERVICE_NAME="${RAILWAY_SERVICE_NAME:-${SERVICE_NAME:-unknown}}"

if [ "$SERVICE_NAME" = "cloakbrowser" ]; then
  echo "Starting CloakBrowser Manager..."
  mkdir -p /data/profiles
  find /data/profiles -maxdepth 2 -name 'SingletonLock' -delete 2>/dev/null || true
  find /data/profiles -maxdepth 2 -name 'SingletonCookie' -delete 2>/dev/null || true
  find /data/profiles -maxdepth 2 -name 'SingletonSocket' -delete 2>/dev/null || true
  rm -f /tmp/.X1*-lock 2>/dev/null || true
  cd /app
  exec uvicorn backend.main:app --host 0.0.0.0 --port 8080 --log-level warning
else
  echo "Starting MarketingBot ($SERVICE_NAME)..."
  exec npm run start:guidenza
fi
