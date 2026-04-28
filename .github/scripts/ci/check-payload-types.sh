#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"
base_ref="${GITHUB_BASE_REF:-}"
summary_file="${GITHUB_STEP_SUMMARY:-}"

if [[ "${GITHUB_EVENT_NAME:-}" != "pull_request" || -z "${base_ref}" ]]; then
  echo "Payload type diff reporting only runs on pull_request events; skipping."
  exit 0
fi

base_commit="origin/${base_ref}"
git -C "${repo_root}" fetch --no-tags origin "${base_ref}" >/dev/null 2>&1
git -C "${repo_root}" rev-parse --verify "${base_commit}" >/dev/null

schema_config_changed='false'
schema_anchor_path=''
schema_changed_files="$(
  git -C "${repo_root}" diff --name-only "${base_commit}...HEAD" -- \
    src/payload.config.ts \
    src/collections \
    src/globals \
    src/blocks \
    src/fields \
    src/plugins
)"

if [[ -n "${schema_changed_files}" ]]; then
  schema_config_changed='true'
  schema_anchor_path="$(printf '%s\n' "${schema_changed_files}" | head -n 1)"
fi

payload_dependency_changed='false'
payload_dependency_anchor_path=''
payload_dependency_changed_files=''

package_json_payload_dependency_changed='false'
if ! git -C "${repo_root}" diff --quiet "${base_commit}...HEAD" -- package.json; then
  if git -C "${repo_root}" diff --unified=0 "${base_commit}...HEAD" -- package.json | grep -Eq \
    '^[+-][[:space:]]+"(payload|@payloadcms/[^"]+)":'; then
    package_json_payload_dependency_changed='true'
    payload_dependency_changed='true'
    payload_dependency_anchor_path='package.json'
    payload_dependency_changed_files='package.json'
  fi
fi

pnpm_lock_payload_dependency_changed='false'
if ! git -C "${repo_root}" diff --quiet "${base_commit}...HEAD" -- pnpm-lock.yaml; then
  if git -C "${repo_root}" diff --unified=0 "${base_commit}...HEAD" -- pnpm-lock.yaml | grep -Eq \
    '^[+-].*(@payloadcms/|(^|[^[:alnum:]_])payload@)'; then
    pnpm_lock_payload_dependency_changed='true'
    payload_dependency_changed='true'
    payload_dependency_anchor_path="${payload_dependency_anchor_path:-pnpm-lock.yaml}"
    if [[ -n "${payload_dependency_changed_files}" ]]; then
      payload_dependency_changed_files="${payload_dependency_changed_files}"$'\n''pnpm-lock.yaml'
    else
      payload_dependency_changed_files='pnpm-lock.yaml'
    fi
  fi
fi

payload_types_changed='false'
if ! git -C "${repo_root}" diff --quiet "${base_commit}...HEAD" -- src/payload-types.ts; then
  payload_types_changed='true'
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "schema_config_changed=${schema_config_changed}"
    echo "schema_anchor_path=${schema_anchor_path}"
    echo "payload_dependency_changed=${payload_dependency_changed}"
    echo "payload_dependency_anchor_path=${payload_dependency_anchor_path}"
    echo "payload_types_changed=${payload_types_changed}"
  } >> "${GITHUB_OUTPUT}"
fi

if [[ "${schema_config_changed}" == 'false' && "${payload_dependency_changed}" == 'false' && "${payload_types_changed}" == 'false' ]]; then
  echo "No Payload-related changes detected."

  if [[ -n "${summary_file}" ]]; then
    {
      echo "## Payload Types"
      echo "- Base ref: \`${base_ref}\`"
      echo "- Result: no Payload-related changes detected."
    } >> "${summary_file}"
  fi

  exit 0
fi

if [[ "${schema_config_changed}" == 'true' ]]; then
  echo "::notice::Payload schema/config inputs changed in this pull request."
fi

if [[ "${payload_dependency_changed}" == 'true' ]]; then
  echo "::notice::Payload package versions changed in this pull request."
fi

if [[ "${payload_types_changed}" == 'true' ]]; then
  echo "::notice::src/payload-types.ts changed in this pull request."
fi

if [[ "${payload_types_changed}" == 'false' && ( "${schema_config_changed}" == 'true' || "${payload_dependency_changed}" == 'true' ) ]]; then
  echo "::warning::Payload inputs changed, but src/payload-types.ts did not."
fi

if [[ "${payload_types_changed}" == 'true' && "${schema_config_changed}" == 'false' && "${payload_dependency_changed}" == 'false' ]]; then
  echo "::warning::src/payload-types.ts changed without a detected schema/config or Payload dependency change."
fi

if [[ -n "${summary_file}" ]]; then
  {
    echo "## Payload Types"
    echo "- Base ref: \`${base_ref}\`"
    echo "- Schema/config inputs changed: \`${schema_config_changed}\`"
    echo "- Payload package versions changed: \`${payload_dependency_changed}\`"
    echo "- Generated \`src/payload-types.ts\` changed: \`${payload_types_changed}\`"
    echo ""
  } >> "${summary_file}"

  if [[ "${schema_config_changed}" == 'true' ]]; then
    {
      echo "<details><summary>schema/config input files</summary>"
      echo ""
      printf '%s\n' "${schema_changed_files}" | sed 's/^/- /'
      echo "</details>"
    } >> "${summary_file}"
  fi

  if [[ "${payload_dependency_changed}" == 'true' ]]; then
    {
      echo "<details><summary>payload dependency files</summary>"
      echo ""
      printf '%s\n' "${payload_dependency_changed_files}" | sed 's/^/- /'
      echo "</details>"
    } >> "${summary_file}"
  fi

  if [[ "${payload_types_changed}" == 'true' ]]; then
    {
      echo "<details><summary>payload-types diff</summary>"
      echo ""
      echo '```diff'
      git -C "${repo_root}" diff --unified=3 "${base_commit}...HEAD" -- src/payload-types.ts | sed '1,4d'
      echo '```'
      echo "</details>"
    } >> "${summary_file}"
  fi
fi
