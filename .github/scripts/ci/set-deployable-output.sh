#!/usr/bin/env bash
set -euo pipefail

event_name="${1:-}"
deployable_from_filter="${2:-false}"

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  echo "GITHUB_OUTPUT is required." >&2
  exit 1
fi

if [[ "${event_name}" == "workflow_dispatch" ]]; then
  echo "deployable=true" >> "$GITHUB_OUTPUT"
  exit 0
fi

echo "deployable=${deployable_from_filter}" >> "$GITHUB_OUTPUT"
