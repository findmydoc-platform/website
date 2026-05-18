#!/usr/bin/env bash
set -euo pipefail

event_name="${1:-}"
base_ref="${2:-}"

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  echo "GITHUB_OUTPUT is required." >&2
  exit 1
fi

if [[ "${event_name}" == "workflow_dispatch" ]]; then
  {
    echo "db_changed=true"
    echo "schema_changed=false"
    echo "migrations_changed=false"
    echo "risk_scan_needed=false"
    echo "changed_files="
  } >> "$GITHUB_OUTPUT"
  echo "Manual dispatch: forcing DB quality migration checks."
  exit 0
fi

if [[ "${event_name}" == "pull_request" && -n "${base_ref}" ]]; then
  git fetch --no-tags --depth=1 origin "${base_ref}"
  range="origin/${base_ref}...HEAD"
  fallback_range="origin/${base_ref}..HEAD"
elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  range="HEAD~1...HEAD"
  fallback_range="HEAD~1..HEAD"
else
  range="HEAD"
  fallback_range="HEAD"
fi

if ! changed_files="$(git diff --name-only --diff-filter=ACMR "${range}" 2>/tmp/migration-diff-error.log)"; then
  echo "Unable to diff ${range}; falling back to ${fallback_range}." >&2
  cat /tmp/migration-diff-error.log >&2 || true
  changed_files="$(git diff --name-only --diff-filter=ACMR "${fallback_range}" || true)"
fi

echo "Diff range: ${range}"
if [[ "${fallback_range}" != "${range}" ]]; then
  echo "Fallback diff range: ${fallback_range}"
fi
echo "Changed files:"
echo "${changed_files:-<none>}"

schema_pattern='^(src/collections/|src/globals/|src/blocks/|src/fields/|src/plugins/|src/payload\.config\.ts)'
migration_pattern='^src/migrations/'
db_tooling_pattern='^(\.github/workflows/db-quality\.yml|\.github/workflows/deploy\.yml|\.github/scripts/ci/(detect-migration-diff|enforce-schema-migration|wait-for-postgres)\.sh|scripts/(migration-risk-scan|test-database-harness)\.mjs|vitest\.config\.ts)$'

schema_changed=false
migrations_changed=false
db_tooling_changed=false

if grep -Eq "${schema_pattern}" <<<"${changed_files}"; then
  schema_changed=true
fi

if grep -Eq "${migration_pattern}" <<<"${changed_files}"; then
  migrations_changed=true
fi

if grep -Eq "${db_tooling_pattern}" <<<"${changed_files}"; then
  db_tooling_changed=true
fi

db_changed=false
if [[ "${schema_changed}" == "true" || "${migrations_changed}" == "true" || "${db_tooling_changed}" == "true" ]]; then
  db_changed=true
fi

{
  echo "db_changed=${db_changed}"
  echo "schema_changed=${schema_changed}"
  echo "migrations_changed=${migrations_changed}"
  echo "risk_scan_needed=${migrations_changed}"
  {
    echo "changed_files<<EOF"
    echo "${changed_files}"
    echo "EOF"
  }
} >> "$GITHUB_OUTPUT"
