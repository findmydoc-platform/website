#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VERCEL_ORG_ID:-}" ]]; then
  echo "VERCEL_ORG_ID is required." >&2
  exit 1
fi

if [[ -z "${VERCEL_PROJECT_ID:-}" ]]; then
  echo "VERCEL_PROJECT_ID is required." >&2
  exit 1
fi

if [[ -n "${EXPECTED_VERCEL_PROJECT_ID:-}" && "${VERCEL_PROJECT_ID}" != "${EXPECTED_VERCEL_PROJECT_ID}" ]]; then
  echo "VERCEL_PROJECT_ID must match EXPECTED_VERCEL_PROJECT_ID for this deployment workflow." >&2
  exit 1
fi
