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
effective_range="${range}"

if ! changed_files="$(git diff --name-only --diff-filter=ACMR "${range}" 2>/tmp/migration-diff-error.log)"; then
  echo "Unable to diff ${range}; falling back to ${fallback_range}." >&2
  cat /tmp/migration-diff-error.log >&2 || true
  changed_files="$(git diff --name-only --diff-filter=ACMR "${fallback_range}" || true)"
  effective_range="${fallback_range}"
fi

echo "Diff range: ${range}"
if [[ "${fallback_range}" != "${range}" ]]; then
  echo "Fallback diff range: ${fallback_range}"
fi
echo "Changed files:"
echo "${changed_files:-<none>}"

# Block renderers live under src/blocks too, but only block config files affect the Payload schema.
schema_pattern='^(src/collections/|src/globals/|src/fields/|src/plugins/|src/payload\.config\.ts|src/blocks/[^[:space:]]+/config\.tsx?$)'
migration_pattern='^src/migrations/'
db_tooling_pattern='^(\.github/workflows/db-quality\.yml|\.github/workflows/deploy\.yml|\.github/scripts/ci/(detect-migration-diff|enforce-schema-migration|wait-for-postgres)\.sh|scripts/(migration-risk-scan|test-database-harness)\.mjs|vitest\.config\.ts)$'
import_export_allowlist_line_regex="^[+-][[:space:]]*\\{[[:space:]]*slug:[[:space:]]*'[^']+'(,[[:space:]]*(import|export):[[:space:]]*false)?[[:space:]]*\\},?[[:space:]]*$"

schema_changed=false
migrations_changed=false
db_tooling_changed=false
schema_changed_files=''

is_import_export_plugin_allowlist_only_change() {
  local diff
  local diff_line

  if ! diff="$(git diff --unified=0 --diff-filter=ACMR "${effective_range}" -- src/plugins/index.ts)"; then
    return 1
  fi

  if [[ -z "${diff}" ]]; then
    return 1
  fi

  while IFS= read -r diff_line; do
    case "${diff_line}" in
      'diff --git'* | 'index '* | '--- '* | '+++ '* | '@@'*)
        continue
        ;;
    esac

    if [[ "${diff_line}" == +* || "${diff_line}" == -* ]]; then
      if [[ ! "${diff_line}" =~ ${import_export_allowlist_line_regex} ]]; then
        return 1
      fi
    fi
  done <<<"${diff}"

  return 0
}

schema_changed_files="$(grep -E "${schema_pattern}" <<<"${changed_files}" || true)"

if grep -qx 'src/plugins/index.ts' <<<"${schema_changed_files}" && is_import_export_plugin_allowlist_only_change; then
  schema_changed_files="$(grep -vx 'src/plugins/index.ts' <<<"${schema_changed_files}" || true)"
fi

if [[ -n "${schema_changed_files}" ]]; then
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
