#!/bin/bash
# Check available API routes
CBM_URL="https://cloakbrowser-production-a859.up.railway.app"
CBM_TOKEN="cbm_8451fa80393151a92fd1a5dc039e91751d7fcafb55c6ca5b"
P1_ID="f8cc785d-72cb-45e9-b1ef-aa843cab78a5"

echo "=== GET /api/profiles ==="
curl -s "$CBM_URL/api/profiles" -H "Authorization: Bearer $CBM_TOKEN" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin),indent=2))" 2>/dev/null | head -20

echo ""
echo "=== POST /api/profiles/{id}/start ==="
curl -s -X POST "$CBM_URL/api/profiles/$P1_ID/start" -H "Authorization: Bearer $CBM_TOKEN" -H "Content-Type: application/json" -d '{}' | python3 -m json.tool 2>/dev/null

echo ""
echo "=== GET /api/profiles/{id} ==="
curl -s "$CBM_URL/api/profiles/$P1_ID" -H "Authorization: Bearer $CBM_TOKEN" | python3 -m json.tool 2>/dev/null | head -20
