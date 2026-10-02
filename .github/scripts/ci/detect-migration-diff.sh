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
  base_revision="$(git merge-base "origin/${base_ref}" HEAD)"
elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  range="HEAD~1...HEAD"
  base_revision="HEAD~1"
else
  range="HEAD"
  base_revision="HEAD"
fi
effective_range="${range}"

for boolean_input in MIGRATIONS_CHANGED DB_TOOLING_CHANGED; do
  if [[ "${!boolean_input:-}" != "true" && "${!boolean_input:-}" != "false" ]]; then
    echo "${boolean_input} must be true or false." >&2
    exit 1
  fi
done

schema_changed_files="$(node -e '
  const files = ["SCHEMA_FILES", "BLOCK_SCHEMA_FILES", "PAYLOAD_SCHEMA_FILES"].flatMap((key) => {
    const value = JSON.parse(process.env[key] ?? "");
    if (!Array.isArray(value) || value.some((file) => typeof file !== "string" || file.includes("\n") || file.includes("\r"))) {
      throw new Error(`Invalid ${key}`);
    }
    return value;
  });
  process.stdout.write([...new Set(files)].join("\n"));
')"
changed_files="$(node -e '
  const files = JSON.parse(process.env.CHANGED_FILES ?? "");
  if (!Array.isArray(files) || files.some((file) => typeof file !== "string" || file.includes("\n") || file.includes("\r"))) throw new Error("Invalid CHANGED_FILES");
  process.stdout.write(files.join("\n"));
')"
echo "Diff range: ${range}"
import_export_allowlist_line_regex="^[+-][[:space:]]*\\{[[:space:]]*slug:[[:space:]]*'[^']+'(,[[:space:]]*(import|export):[[:space:]]*false)?[[:space:]]*\\},?[[:space:]]*$"
import_export_target_slug_line_regex="^[+-][[:space:]]*'[A-Za-z0-9-]+',[[:space:]]*$"
import_export_index_runtime_line_regex="^[+-][[:space:]]*(import[[:space:]]+\\{[[:space:]]*importExportPlugin[[:space:]]*\\}[[:space:]]+from[[:space:]]+'@payloadcms/plugin-import-export'|import[[:space:]]+\\{[[:space:]]*importExport[[:space:]]*\\}[[:space:]]+from[[:space:]]+'\\./importExport'|importExportPlugin\\(\\{|collections:[[:space:]]*\\[|\\],|\\}\\),|importExport,)[[:space:]]*$"
import_export_module_import_line_regex="^[+-][[:space:]]*(import[[:space:]]+\\{[[:space:]]*importExportPlugin[[:space:]]*\\}[[:space:]]+from[[:space:]]+'@payloadcms/plugin-import-export'|import[[:space:]]+type[[:space:]]+\\{[[:space:]]*ImportExportPluginConfig[[:space:]]*\\}[[:space:]]+from[[:space:]]+'@payloadcms/plugin-import-export/types'|import[[:space:]]+type[[:space:]]+\\{[[:space:]]*CollectionSlug[[:space:]]*\\}[[:space:]]+from[[:space:]]+'payload'|import[[:space:]]+\\{[[:space:]]*securePlatformManagedPluginCollection[[:space:]]*\\}[[:space:]]+from[[:space:]]+'@/security/generatedCollectionAccess')[[:space:]]*$"
import_export_module_config_line_regex="^[+-][[:space:]]*(export[[:space:]]+const[[:space:]]+importExportTargetSlugs[[:space:]]*=[[:space:]]*\\[|\\][[:space:]]+as[[:space:]]+const[[:space:]]+satisfies[[:space:]]+readonly[[:space:]]+CollectionSlug\\[\\]|export[[:space:]]+const[[:space:]]+importExportPluginConfig[[:space:]]*=[[:space:]]*\\{|collections:[[:space:]]*importExportTargetSlugs\\.map\\(\\(slug\\)[[:space:]]*=>[[:space:]]*\\(\\{[[:space:]]*slug[[:space:]]*\\}\\)\\),|overrideExportCollection:[[:space:]]*securePlatformManagedPluginCollection,|overrideImportCollection:[[:space:]]*securePlatformManagedPluginCollection,|\\}[[:space:]]+satisfies[[:space:]]+ImportExportPluginConfig|export[[:space:]]+const[[:space:]]+importExport[[:space:]]*=[[:space:]]*importExportPlugin\\(importExportPluginConfig\\))[[:space:]]*$"
hook_only_collection_hook_identifier_regex="(beforeChangeValidateDoctorProfileImage|beforeOperationPrepareUploadFilename|beforeOperationValidateMediaUpload|createSupabaseUserHook|enforcePlatformStaffEmailDomainHook|revalidateDeletedPlatformContentMediaConsumers|revalidatePlatformContentMediaConsumers|revalidate[[:alnum:]_]+|stableIdBeforeChangeHook|updateAverage(Price|Ratings)After(Change|Delete))"
hook_only_collection_hook_expression_regex="(${hook_only_collection_hook_identifier_regex}|beforeChangeAssignClinicFromUser\\(\\{[[:space:]]*clinicField:[[:space:]]*'clinic'[[:space:]]*\\}\\))"
hook_only_collection_line_regex="^[+-][[:space:]]*(import[[:space:]]*\\{|import[[:space:]].*from[[:space:]]'(@/hooks|\\./hooks)/[^']+'|\\}[[:space:]]*from[[:space:]]'(@/hooks|\\./hooks)/[^']+'|(beforeOperation|beforeChange|afterChange|afterDelete):[[:space:]]*\\[|\\],?|[[:space:]]*((beforeOperation|beforeChange|afterChange|afterDelete):[[:space:]]*\\[)?${hook_only_collection_hook_expression_regex}(,[[:space:]]*${hook_only_collection_hook_expression_regex})*\\]?,?|\\{|\\})[[:space:]]*$"
collection_upload_component_line_regex="^[+-][[:space:]]*(components:[[:space:]]*\\{|edit:[[:space:]]*\\{|Upload:[[:space:]]*'@/app/\\(payload\\)/components/PolicyAwareUpload',?|\\{|\\},?)[[:space:]]*$"
collection_crypto_import_line_regex="^[+-][[:space:]]*import[[:space:]]*\\{[[:space:]]*randomUUID[[:space:]]*\\}[[:space:]]*from[[:space:]]*'(node:)?crypto'[[:space:]]*$"
collection_field_access_import_line_regex="^[+-][[:space:]]*(import[[:space:]]+\\{[[:space:]]*([A-Za-z_][A-Za-z0-9_]*Access[[:space:]]*,?[[:space:]]*)+\\}[[:space:]]+from[[:space:]]+'@/access/fieldAccess'|import[[:space:]]+\\{|\\}[[:space:]]+from[[:space:]]+'@/access/fieldAccess'|[A-Za-z_][A-Za-z0-9_]*Access,?)[[:space:]]*$"
collection_field_access_line_regex="^[+-][[:space:]]*(//.*|access:[[:space:]]*\\{|(create|read|update):[[:space:]]*[A-Za-z_][A-Za-z0-9_]*FieldAccess,?)[[:space:]]*$"
payload_config_endpoint_import_line_regex="^[+-][[:space:]]*import[[:space:]]*\\{[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*\\}[[:space:]]*from[[:space:]]*'./endpoints/[A-Za-z0-9_./-]+'[[:space:]]*$"
payload_config_endpoint_line_regex="^[+-][[:space:]]*(\\{|\\},?|path:[[:space:]]*'/?[A-Za-z0-9_./-]+'[,]?|method:[[:space:]]*'(get|post|put|patch|delete)'[,]?|handler:[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]+as[[:space:]]+PayloadHandler[,]?)[[:space:]]*$"
payload_config_upload_policy_import_line_regex="^[+-][[:space:]]*import[[:space:]]*\\{[[:space:]]*MEDIA_UPLOAD_MAX_BYTES,[[:space:]]*MEDIA_UPLOAD_TOO_LARGE_MESSAGE[[:space:]]*\\}[[:space:]]*from[[:space:]]*'@/config/mediaUploadPolicy'[[:space:]]*$"
payload_config_upload_policy_line_regex="^[+-][[:space:]]*(//.*|upload:[[:space:]]*\\{|limits:[[:space:]]*\\{|fileSize:[[:space:]]*(MEDIA_UPLOAD_MAX_BYTES|5[[:space:]]*\\*[[:space:]]*1024[[:space:]]*\\*[[:space:]]*1024),?([[:space:]]*//.*)?|abortOnLimit:[[:space:]]*true,?|responseOnLimit:[[:space:]]*(MEDIA_UPLOAD_TOO_LARGE_MESSAGE|'File size limit exceeded \\(5MB\\)'),?|safeFileNames:[[:space:]]*true,?|\\},?)[[:space:]]*$"

schema_changed=false
migrations_changed="${MIGRATIONS_CHANGED}"
db_tooling_changed="${DB_TOOLING_CHANGED}"

is_import_export_plugin_index_runtime_only_change() {
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
      if [[ ! "${diff_line}" =~ ${import_export_allowlist_line_regex} && ! "${diff_line}" =~ ${import_export_index_runtime_line_regex} ]]; then
        return 1
      fi
    fi
  done <<<"${diff}"

  return 0
}

# Generated plugin collection access changes runtime authorization only. Keep
# this allowlist deliberately narrow so field or plugin-option changes still
# reach Payload's migration alignment check.
is_plugin_collection_access_only_change() {
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

    case "${diff_line}" in
      "+import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'" | \
        "-import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'" | \
        '+      access: generatedCollectionAccess.redirects,' | \
        '-      access: generatedCollectionAccess.redirects,' | \
        '+      access: generatedCollectionAccess.forms,' | \
        '-      access: generatedCollectionAccess.forms,' | \
        "+      access: generatedCollectionAccess['form-submissions']," | \
        "-      access: generatedCollectionAccess['form-submissions'],")
        ;;
      +* | -*)
        return 1
        ;;
    esac
  done <<<"${diff}"

  return 0
}

# This dedicated module may change only the target allowlist and runtime access
# wiring. Any other plugin option remains schema-relevant and reaches Payload's
# migration alignment check.
is_import_export_plugin_module_runtime_only_change() {
  local diff
  local diff_line

  if ! diff="$(git diff --unified=0 --diff-filter=ACMR "${effective_range}" -- src/plugins/importExport.ts)"; then
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
      if [[ "${diff_line}" =~ ^[+-][[:space:]]*$ ]]; then
        continue
      fi

      if [[ ! "${diff_line}" =~ ${import_export_target_slug_line_regex} && ! "${diff_line}" =~ ${import_export_module_import_line_regex} && ! "${diff_line}" =~ ${import_export_module_config_line_regex} ]]; then
        return 1
      fi
    fi
  done <<<"${diff}"

  return 0
}

is_runtime_only_collection_change() {
  local file_path="$1"
  local diff
  local diff_line

  if ! diff="$(git diff --unified=0 --diff-filter=ACMR "${effective_range}" -- "${file_path}")"; then
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
      if [[ "${diff_line}" =~ ^[+-][[:space:]]*$ ]]; then
        continue
      fi

      if [[ ! "${diff_line}" =~ ${hook_only_collection_line_regex} && ! "${diff_line}" =~ ${collection_upload_component_line_regex} && ! "${diff_line}" =~ ${collection_crypto_import_line_regex} && ! "${diff_line}" =~ ${collection_field_access_import_line_regex} && ! "${diff_line}" =~ ${collection_field_access_line_regex} ]]; then
        return 1
      fi
    fi
  done <<<"${diff}"

  return 0
}

# Prettier-only changes do not affect the persisted Payload schema. The
# whitespace check handles simple changes without starting Prettier; the second
# comparison recognizes formatter upgrades that also reflow lines.
is_format_only_change() {
  local file_path="$1"

  if git diff --ignore-all-space --exit-code "${effective_range}" -- "${file_path}" >/dev/null; then
    return 0
  fi

  git show "${base_revision}:${file_path}" 2>/dev/null |
    pnpm exec prettier --stdin-filepath "${file_path}" |
    cmp -s - "${file_path}"
}

# Payload's top-level upload parser limit controls request handling, not persisted fields.
is_upload_policy_only_payload_config_change() {
  local diff
  local diff_line

  if ! diff="$(git diff --unified=0 --diff-filter=ACMR "${effective_range}" -- src/payload.config.ts)"; then
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
      if [[ ! "${diff_line}" =~ ${payload_config_upload_policy_import_line_regex} && ! "${diff_line}" =~ ${payload_config_upload_policy_line_regex} ]]; then
        return 1
      fi
    fi
  done <<<"${diff}"

  return 0
}

# Endpoint registrations change Payload runtime routing, not the persisted database schema.
is_endpoint_only_payload_config_change() {
  local diff
  local diff_line

  if ! diff="$(git diff --unified=0 --diff-filter=ACMR "${effective_range}" -- src/payload.config.ts)"; then
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
      if [[ ! "${diff_line}" =~ ${payload_config_endpoint_import_line_regex} && ! "${diff_line}" =~ ${payload_config_endpoint_line_regex} ]]; then
        return 1
      fi
    fi
  done <<<"${diff}"

  return 0
}



if grep -qx 'src/plugins/index.ts' <<<"${schema_changed_files}" && { is_import_export_plugin_index_runtime_only_change || is_plugin_collection_access_only_change; }; then
  schema_changed_files="$(grep -vx 'src/plugins/index.ts' <<<"${schema_changed_files}" || true)"
fi

if grep -qx 'src/plugins/importExport.ts' <<<"${schema_changed_files}" && is_import_export_plugin_module_runtime_only_change; then
  schema_changed_files="$(grep -vx 'src/plugins/importExport.ts' <<<"${schema_changed_files}" || true)"
fi

if grep -qx 'src/payload.config.ts' <<<"${schema_changed_files}" && { is_endpoint_only_payload_config_change || is_upload_policy_only_payload_config_change; }; then
  schema_changed_files="$(grep -vx 'src/payload.config.ts' <<<"${schema_changed_files}" || true)"
fi

if [[ -n "${schema_changed_files}" ]]; then
  hook_only_schema_changed_files=''
  while IFS= read -r schema_file; do
    if [[ -z "${schema_file}" ]]; then
      continue
    fi

    if is_format_only_change "${schema_file}"; then
      continue
    fi

    if [[ "${schema_file}" =~ ^src/collections/ ]] && is_runtime_only_collection_change "${schema_file}"; then
      continue
    fi

    hook_only_schema_changed_files+="${schema_file}"$'\n'
  done <<<"${schema_changed_files}"
  schema_changed_files="${hook_only_schema_changed_files}"
fi

if [[ -n "${schema_changed_files}" ]]; then
  echo "Schema-relevant files after allowlists:"
  echo "${schema_changed_files}"
else
  echo "No schema-relevant files after allowlists."
fi

if [[ -n "${schema_changed_files}" ]]; then
  schema_changed=true
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
