#!/bin/bash

# ── Configuration ─────────────────────────────────────────────────────────────

API_URL="https://www.decidedforme.com/api/places/search"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found." >&2
  exit 1
fi

# shellcheck source=find-restaurant.env
source "$ENV_FILE"

# ── Colors ────────────────────────────────────────────────────────────────────

BOLD='\033[1m'
RESET='\033[0m'
DIM='\033[2m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
RED='\033[0;31m'
WHITE='\033[1;37m'

# ── Args ──────────────────────────────────────────────────────────────────────

VEGETARIAN=false
VEGAN=false
for arg in "$@"; do
  case "$arg" in
    -v|--vegetarian) VEGETARIAN=true ;;
    -vv|--vegan) VEGAN=true ;;
  esac
done

if [ "$VEGAN" = "true" ]; then
  TEXT_QUERY="vegan-friendly $TEXT_QUERY"
elif [ "$VEGETARIAN" = "true" ]; then
  TEXT_QUERY="vegetarian-friendly $TEXT_QUERY"
fi

# ── Main ──────────────────────────────────────────────────────────────────────

# Check dependencies
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required. Install with: brew install jq${RESET}"
  exit 1
fi

echo -e "\n${CYAN}${BOLD}Searching for restaurants...${RESET}\n"

PAYLOAD=$(jq -n \
  --arg textQuery "$TEXT_QUERY" \
  --arg includedType "$INCLUDED_TYPE" \
  --argjson maxResultCount "$MAX_RESULTS" \
  --argjson lat "$CENTER_LAT" \
  --argjson lon "$CENTER_LON" \
  --argjson radius "$DUMMY_RADIUS" \
  --argjson priceLevels "$PRICE_LEVELS" \
  --argjson minRating "$MIN_RATING" \
  --argjson openNow "$OPEN_NOW" \
  '{
    textQuery: $textQuery,
    maxResultCount: $maxResultCount,
    includedType: $includedType,
    locationBias: { circle: { center: { latitude: $lat, longitude: $lon }, radius: $radius } },
    priceLevels: $priceLevels,
    minRating: $minRating,
    openNow: $openNow
  }')

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

TOTAL=$(echo "$RESPONSE" | jq '.places | length' 2>/dev/null)

if [ -z "$TOTAL" ] || [ "$TOTAL" -eq 0 ]; then
  echo -e "${RED}No restaurants found in response.${RESET}"
  exit 1
fi

if [ "$DEBUG" = "true" ]; then
  echo -e "${BOLD}${CYAN}── Request ──────────────────────────────────────────${RESET}"
  echo -e "${DIM}POST $API_URL${RESET}"
  echo "$PAYLOAD" | jq -C '.'
  echo -e "${BOLD}${CYAN}─────────────────────────────────────────────────────${RESET}\n"
fi

echo -e "${DIM}Found ${WHITE}${BOLD}$TOTAL${RESET}${DIM} results — picking $PICK_COUNT at random${RESET}\n"


# Pick up to PICK_COUNT random unique indices
MAX=$(( TOTAL < PICK_COUNT ? TOTAL : PICK_COUNT ))
INDICES=()
while [ ${#INDICES[@]} -lt $MAX ]; do
  IDX=$((RANDOM % TOTAL))
  DUPE=0
  for i in "${INDICES[@]}"; do
    [ "$i" -eq "$IDX" ] && DUPE=1 && break
  done
  [ $DUPE -eq 0 ] && INDICES+=($IDX)
done

# Haversine distance in miles, with walking time
calc_distance() {
  awk -v lat1="$1" -v lon1="$2" -v lat2="$CENTER_LAT" -v lon2="$CENTER_LON" -v pace="$WALK_PACE_MPM" '
  BEGIN {
    pi = 3.14159265358979323846
    R = 3958.8
    dLat = (lat2 - lat1) * pi / 180
    dLon = (lon2 - lon1) * pi / 180
    a = sin(dLat/2)^2 + cos(lat1*pi/180) * cos(lat2*pi/180) * sin(dLon/2)^2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    d = R * c
    printf "%.2f mi (~%d min walk)", d, int(d * pace + 0.5)
  }'
}

# Format food type from types array (strip generic tags)
format_type() {
  echo "$1" | jq -r '
    map(select(
      . != "restaurant" and
      . != "point_of_interest" and
      . != "food" and
      . != "establishment" and
      . != "store"
    )) | first // "Restaurant"
  ' | tr '_' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'
}

# Header
echo -e "${BOLD}${MAGENTA}┌──────────────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}${MAGENTA}│            🍽️  Your Restaurant Picks             │${RESET}"
echo -e "${BOLD}${MAGENTA}└──────────────────────────────────────────────────┘${RESET}"
echo ""

COUNT=1
for IDX in "${INDICES[@]}"; do
  NAME=$(echo "$RESPONSE"      | jq -r ".places[$IDX].displayName.text")
  ADDRESS=$(echo "$RESPONSE"   | jq -r ".places[$IDX].formattedAddress")
  MAPS_URI=$(echo "$RESPONSE"  | jq -r ".places[$IDX].googleMapsUri")
  RATING=$(echo "$RESPONSE"    | jq -r ".places[$IDX].rating")
  LAT=$(echo "$RESPONSE"       | jq -r ".places[$IDX].location.latitude")
  LON=$(echo "$RESPONSE"       | jq -r ".places[$IDX].location.longitude")
  TYPES_JSON=$(echo "$RESPONSE" | jq ".places[$IDX].types")
  PRICE_LEVEL=$(echo "$RESPONSE" | jq -r ".places[$IDX].priceLevel // \"N/A\"" | \
    sed 's/PRICE_LEVEL_INEXPENSIVE/$ Inexpensive/' | \
    sed 's/PRICE_LEVEL_MODERATE/$$ Moderate/' | \
    sed 's/PRICE_LEVEL_EXPENSIVE/$$$ Expensive/' | \
    sed 's/PRICE_LEVEL_VERY_EXPENSIVE/$$$$ Very Expensive/')

  FOOD_TYPE=$(format_type "$TYPES_JSON")
  DISTANCE=$(calc_distance "$LAT" "$LON")

  echo -e "  ${BOLD}${YELLOW}$COUNT. $NAME${RESET}"
  echo -e "     ${GREEN}Address  ${DIM}│${RESET} ${WHITE}$ADDRESS${RESET}"
  echo -e "     ${CYAN}Distance ${DIM}│${RESET} ${WHITE}$DISTANCE${RESET}"
  echo -e "     ${MAGENTA}Cuisine  ${DIM}│${RESET} ${WHITE}$FOOD_TYPE${RESET}"
  echo -e "     ${BLUE}Rating   ${DIM}│${RESET} ${WHITE}★ $RATING${RESET}"
  echo -e "     ${GREEN}Price    ${DIM}│${RESET} ${WHITE}$PRICE_LEVEL${RESET}"
  echo -e "     ${RED}Maps     ${DIM}│${RESET} ${WHITE}$MAPS_URI${RESET}"

  if [ $COUNT -lt $MAX ]; then
    echo -e "     ${DIM}··········································${RESET}"
  fi
  echo ""

  COUNT=$((COUNT + 1))
done
