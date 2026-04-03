#!/usr/bin/env bash
set -euo pipefail

pending_migration_files="${1:-}"

if [[ -z "${pending_migration_files}" ]]; then
  pending_migration_files="$(git status --porcelain -- src/migrations)"
fi

echo "Detected generated migration artifacts:"
echo "${pending_migration_files:-<none>}"

generated_migration_ts_files="$(awk '$1=="??" && $2 ~ /^src\/migrations\/.*\.ts$/ {print $2}' <<<"${pending_migration_files}")"

if [[ -n "${generated_migration_ts_files}" ]]; then
  while IFS= read -r migration_file; do
    if [[ -z "${migration_file}" || ! -f "${migration_file}" ]]; then
      continue
    fi

    echo
    echo "===== Generated migration: ${migration_file} ====="
    cat "${migration_file}"
  done <<<"${generated_migration_ts_files}"
fi

echo
echo "Generating Payload TypeScript DB schema snapshot for debug..."
if ! pnpm run payload generate:db-schema; then
  echo "Warning: payload generate:db-schema failed; skipping schema snapshot output."
  exit 0
fi

if [[ ! -f src/payload-generated-schema.ts ]]; then
  echo "Warning: src/payload-generated-schema.ts was not created."
  exit 0
fi

echo
echo "===== Schema excerpt (imports/exports collection_slug) ====="
schema_pattern="export const exports =|export const imports =|collectionSlug: varchar\\('collection_slug'\\)|enum_imports_collection_slug"

if command -v rg >/dev/null 2>&1; then
  rg -n "${schema_pattern}" src/payload-generated-schema.ts | head -n 80
else
  grep -En "${schema_pattern}" src/payload-generated-schema.ts | head -n 80
fi
