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

hosted_runtime=false
if [[ "${VERCEL:-}" == "1" || "${VERCEL_ENV:-}" == "preview" || "${VERCEL_ENV:-}" == "production" ]]; then
  hosted_runtime=true
elif [[ "${CI:-}" == "true" && ( "${DEPLOYMENT_ENV:-}" == "preview" || "${DEPLOYMENT_ENV:-}" == "production" ) ]]; then
  hosted_runtime=true
fi

if [[ -n "${DATABASE_DIRECT_URI:-}" ]]; then
  migration_database_uri="${DATABASE_DIRECT_URI}"
elif [[ "${hosted_runtime}" == "true" ]]; then
  echo "DATABASE_DIRECT_URI is required for hosted Payload migration commands." >&2
  exit 1
elif [[ -n "${DATABASE_URI:-}" ]]; then
  echo "DATABASE_DIRECT_URI is not set; using DATABASE_URI for a local or CI database command." >&2
  migration_database_uri="${DATABASE_URI}"
else
  echo "DATABASE_DIRECT_URI or a local DATABASE_URI is required for Payload migration commands." >&2
  exit 1
fi

export DATABASE_URI="${migration_database_uri}"
unset DATABASE_DIRECT_URI
export PAYLOAD_DATABASE_OPERATION="migration"
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
