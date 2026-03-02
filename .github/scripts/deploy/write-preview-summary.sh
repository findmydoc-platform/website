#!/usr/bin/env bash
set -euo pipefail

outcome="${1:-}"
deployment_url="${2:-}"

{
  echo "## Preview Deployment Summary"
  if [[ "${outcome}" == "success" ]]; then
    echo "- **Status**: Success"
    echo "- **URL**: ${deployment_url}"
    echo "- **Alias**: https://findmydoc-portal-tst.vercel.app"
  else
    echo "- **Status**: Failed"
  fi
} >> "$GITHUB_STEP_SUMMARY"
