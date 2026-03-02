#!/usr/bin/env bash
set -euo pipefail

outcome="${1:-}"
deployment_url="${2:-}"

{
  echo "## Production Deployment Summary"
  if [[ "${outcome}" == "success" ]]; then
    echo "- **Status**: Success"
    echo "- **URL**: ${deployment_url}"
  else
    echo "- **Status**: Failed"
  fi
} >> "$GITHUB_STEP_SUMMARY"
