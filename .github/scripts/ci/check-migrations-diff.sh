#!/usr/bin/env bash
set -euo pipefail

base_ref="${1:-origin/main}"
head_ref="${2:-HEAD}"

if ! git rev-parse --verify "${base_ref}" >/dev/null 2>&1; then
  base_branch="${base_ref#origin/}"
  git fetch --no-tags --depth=1 origin "${base_branch}" >/dev/null 2>&1 || true
fi

if ! git rev-parse --verify "${base_ref}" >/dev/null 2>&1; then
  echo "Base ref ${base_ref} not found. Skipping migration diff check."
  exit 0
fi

if git diff --quiet "${base_ref}" "${head_ref}" -- src/migrations/; then
  echo "No migrations changed."
else
  echo "ALERT: Migration scripts changed!"
fi
