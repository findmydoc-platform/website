#!/usr/bin/env bash
set -euo pipefail

confirmation="${1:-}"

if [[ "${confirmation}" != "RESET_PREVIEW_DB" ]]; then
  echo "::error::Invalid confirmation value. Use RESET_PREVIEW_DB to run this workflow."
  exit 1
fi

if [[ -z "${DATABASE_URI:-}" || -z "${PAYLOAD_SECRET:-}" ]]; then
  echo "::error::DATABASE_URI and PAYLOAD_SECRET must be present in the Preview environment secrets."
  exit 1
fi

echo "Running preview database reset with payload migrate:fresh..."
printf "y\n" | pnpm run payload migrate:fresh
echo "Preview database reset completed."
