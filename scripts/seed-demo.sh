#!/bin/bash
# seed-demo.sh — Inyecta ejecuciones de prueba en el dashboard
#
# USO:
#   chmod +x scripts/seed-demo.sh
#   ./scripts/seed-demo.sh <API_KEY> [URL_BASE]
#
# EJEMPLOS:
#   # Local
#   ./scripts/seed-demo.sh sk_abc123def456
#
#   # Producción (Vercel)
#   ./scripts/seed-demo.sh sk_abc123def456 https://tu-dashboard.vercel.app

set -e

API_KEY="${1:?Error: Debes pasar la API key como primer argumento. Ej: ./seed-demo.sh sk_xxxx}"
BASE_URL="${2:-http://localhost:3000}"
WEBHOOK_URL="$BASE_URL/api/execution-webhook"

echo ""
echo "=== Seed Demo: Dashboard AI Mate ==="
echo "URL:     $WEBHOOK_URL"
echo "API Key: ${API_KEY:0:8}..."
echo ""

send() {
  local name="$1"
  local status="$2"
  local timestamp="$3"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$API_KEY\", \"automation_name\": \"$name\", \"status\": \"$status\", \"timestamp\": \"$timestamp\"}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -1)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ $name [$status]"
  else
    echo "  ✗ $name [$status] → HTTP $HTTP_CODE: $BODY"
  fi
}

# Generar timestamps de los últimos 7 días
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
D1=$(date -u -d "1 day ago" +"%Y-%m-%dT10:00:00Z" 2>/dev/null || date -u -v-1d +"%Y-%m-%dT10:00:00Z")
D2=$(date -u -d "2 days ago" +"%Y-%m-%dT14:30:00Z" 2>/dev/null || date -u -v-2d +"%Y-%m-%dT14:30:00Z")
D3=$(date -u -d "3 days ago" +"%Y-%m-%dT09:15:00Z" 2>/dev/null || date -u -v-3d +"%Y-%m-%dT09:15:00Z")
D4=$(date -u -d "4 days ago" +"%Y-%m-%dT11:45:00Z" 2>/dev/null || date -u -v-4d +"%Y-%m-%dT11:45:00Z")
D5=$(date -u -d "5 days ago" +"%Y-%m-%dT16:00:00Z" 2>/dev/null || date -u -v-5d +"%Y-%m-%dT16:00:00Z")
D6=$(date -u -d "6 days ago" +"%Y-%m-%dT08:30:00Z" 2>/dev/null || date -u -v-6d +"%Y-%m-%dT08:30:00Z")

echo "--- Clasificador de Emails ---"
send "Clasificador de Emails" "success" "$D6"
send "Clasificador de Emails" "success" "$D5"
send "Clasificador de Emails" "success" "$D4"
send "Clasificador de Emails" "error"   "$D4"
send "Clasificador de Emails" "success" "$D3"
send "Clasificador de Emails" "success" "$D2"
send "Clasificador de Emails" "success" "$D1"
send "Clasificador de Emails" "success" "$NOW"

echo ""
echo "--- Procesado de Facturas ---"
send "Procesado de Facturas" "success" "$D5"
send "Procesado de Facturas" "success" "$D3"
send "Procesado de Facturas" "error"   "$D3"
send "Procesado de Facturas" "success" "$D2"
send "Procesado de Facturas" "success" "$D1"
send "Procesado de Facturas" "success" "$NOW"

echo ""
echo "--- Generación de Informes ---"
send "Generacion de Informes" "success" "$D6"
send "Generacion de Informes" "success" "$D4"
send "Generacion de Informes" "success" "$D2"
send "Generacion de Informes" "success" "$NOW"

echo ""
echo "--- Sync CRM ---"
send "Sync CRM" "success" "$D5"
send "Sync CRM" "success" "$D4"
send "Sync CRM" "success" "$D3"
send "Sync CRM" "error"   "$D2"
send "Sync CRM" "success" "$D1"

echo ""
echo "=== Completado ==="
echo ""
echo "IMPORTANTE: Las automatizaciones se han creado con coste=0."
echo "Ve a /admin y configura para cada una:"
echo "  - Tiempo manual (minutos)"
echo "  - Coste por hora (€)"
echo "Esto determinará el ahorro mostrado en el dashboard."
echo ""
