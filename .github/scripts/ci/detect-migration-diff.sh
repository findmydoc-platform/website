#!/usr/bin/env bash
set -euo pipefail

event_name="${1:-}"
base_ref="${2:-}"

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  echo "GITHUB_OUTPUT is required." >&2
  exit 1
fi

if [[ "${event_name}" == "pull_request" && -n "${base_ref}" ]]; then
  git fetch --no-tags --depth=1 origin "${base_ref}"
  range="origin/${base_ref}...HEAD"
elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  range="HEAD~1...HEAD"
else
  range="HEAD"
fi

changed_files="$(git diff --name-only --diff-filter=ACMR "${range}" || true)"

echo "Diff range: ${range}"
echo "Changed files:"
echo "${changed_files:-<none>}"

schema_pattern='^(src/collections/|src/globals/|src/blocks/|src/fields/|src/plugins/|src/payload\.config\.ts)'
migration_pattern='^src/migrations/'

if grep -Eq "${schema_pattern}" <<<"${changed_files}"; then
  echo "schema_changed=true" >> "$GITHUB_OUTPUT"
else
  echo "schema_changed=false" >> "$GITHUB_OUTPUT"
fi

if grep -Eq "${migration_pattern}" <<<"${changed_files}"; then
  echo "migrations_changed=true" >> "$GITHUB_OUTPUT"
else
  echo "migrations_changed=false" >> "$GITHUB_OUTPUT"
fi
