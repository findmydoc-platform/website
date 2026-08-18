#!/usr/bin/env bash

set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to run Payload migrations." >&2
  exit 1
fi

pnpm_version="$(pnpm --version)"
if [[ "${pnpm_version%%.*}" != "10" ]]; then
  echo "pnpm 10 is required; found ${pnpm_version}." >&2
  exit 1
fi

export PAYLOAD_SECRET="${PAYLOAD_SECRET:-dev-secret}"

case "${1:-}" in
  migrate)
    printf 'y\n' | pnpm payload migrate
    ;;
  migrate:fresh)
    printf 'y\n' | pnpm payload migrate:fresh
    ;;
  migrate:status)
    pnpm payload migrate:status
    ;;
  generate-from-scratch)
    printf 'y\n' | pnpm run generateDBFromScratch
    ;;
  *)
    echo "Usage: $0 {migrate|migrate:fresh|migrate:status|generate-from-scratch}" >&2
    exit 2
    ;;
esac
