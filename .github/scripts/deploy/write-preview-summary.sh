#!/usr/bin/env bash
set -euo pipefail

outcome="${1:-}"
deployment_url="${2:-}"
preview_alias="${3:-}"

{
  echo "## Preview Deployment Summary"
  if [[ "${outcome}" == "success" ]]; then
    echo "- **Status**: Success"
    echo "- **URL**: ${deployment_url}"
    if [[ -n "${preview_alias}" ]]; then
      echo "- **Alias**: ${preview_alias}"
    fi
  else
    echo "- **Status**: Failed"
  fi
} >> "$GITHUB_STEP_SUMMARY"
