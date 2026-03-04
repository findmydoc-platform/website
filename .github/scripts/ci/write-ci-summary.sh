#!/usr/bin/env bash
set -euo pipefail

lint_outcome="${1:-unknown}"
unit_outcome="${2:-unknown}"
storybook_outcome="${3:-unknown}"

{
  echo "## CI Job Summary"
  echo "- **Lint**: ${lint_outcome}"
  echo "- **Unit Tests**: ${unit_outcome}"
  echo "- **Storybook Tests**: ${storybook_outcome}"
} >> "$GITHUB_STEP_SUMMARY"
