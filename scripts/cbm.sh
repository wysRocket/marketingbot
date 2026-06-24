#!/bin/bash
source "$(dirname "$0")/cbm.env"
case "$1" in
  start-p1) curl -s -X POST "$CBM_URL/api/profiles/$P1_ID/launch" -H "Authorization: Bearer $CBM_TOKEN" -H "Content-Type: application/json" -d '{}' ;;
  start-p2) curl -s -X POST "$CBM_URL/api/profiles/$P2_ID/launch" -H "Authorization: Bearer $CBM_TOKEN" -H "Content-Type: application/json" -d '{}' ;;
  stop-p1)  curl -s -X POST "$CBM_URL/api/profiles/$P1_ID/stop" -H "Authorization: Bearer $CBM_TOKEN" -H "Content-Type: application/json" -d '{}' ;;
  stop-p2)  curl -s -X POST "$CBM_URL/api/profiles/$P2_ID/stop" -H "Authorization: Bearer $CBM_TOKEN" -H "Content-Type: application/json" -d '{}' ;;
  status)
    curl -s "$CBM_URL/api/profiles" -H "Authorization: Bearer $CBM_TOKEN" | python3 -c "
import sys,json
profiles = json.load(sys.stdin)
for p in profiles:
    print(f\"  {p['name']}: status={p['status']} cdp={p.get('cdp_url','N/A')}\")" ;;
  *) echo "Usage: $0 {start-p1|start-p2|stop-p1|stop-p2|status}" ;;
esac
