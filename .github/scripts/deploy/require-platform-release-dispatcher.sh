#!/usr/bin/env bash
set -euo pipefail

readonly expected_actor='findmydoc-platform-release[bot]'

if [[ "${GITHUB_ACTOR:-}" != "${expected_actor}" ]] || [[ "${GITHUB_TRIGGERING_ACTOR:-}" != "${expected_actor}" ]]; then
  echo "Production deployment dispatch must be initiated by the platform release GitHub App." >&2
  exit 1
fi
