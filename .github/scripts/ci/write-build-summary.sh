#!/usr/bin/env bash
set -euo pipefail

build_outcome="${1:-unknown}"
integration_outcome="${2:-unknown}"

{
  echo "## Build Job Summary"
  echo "- **Build**: ${build_outcome}"
  echo "- **Integration Tests**: ${integration_outcome}"
} >> "$GITHUB_STEP_SUMMARY"
