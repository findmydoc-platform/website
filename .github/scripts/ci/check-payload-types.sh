#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"
base_ref="${GITHUB_BASE_REF:-}"
summary_file="${GITHUB_STEP_SUMMARY:-}"
snippet_max_hunks=3
snippet_max_lines=120

if [[ "${GITHUB_EVENT_NAME:-}" != "pull_request" || -z "${base_ref}" ]]; then
  echo "Payload type diff reporting only runs on pull_request events; skipping."
  exit 0
fi

base_commit="origin/${base_ref}"
git -C "${repo_root}" fetch --no-tags origin "${base_ref}" >/dev/null 2>&1
git -C "${repo_root}" rev-parse --verify "${base_commit}" >/dev/null

write_multiline_output() {
  local key="$1"
  local value="$2"
  local delimiter="PAYLOAD_TYPES_${key}_EOF"

  {
    echo "${key}<<${delimiter}"
    printf '%s\n' "${value}"
    echo "${delimiter}"
  } >> "${GITHUB_OUTPUT}"
}

emit_outputs() {
  if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
    return
  fi

  {
    echo "schema_config_changed=${schema_config_changed}"
    echo "schema_anchor_path=${schema_anchor_path}"
    echo "payload_dependency_changed=${payload_dependency_changed}"
    echo "payload_dependency_anchor_path=${payload_dependency_anchor_path}"
    echo "dependency_manifest_changed=${dependency_manifest_changed}"
    echo "committed_payload_types_changed=${committed_payload_types_changed}"
    echo "generated_diff_detected=${generated_diff_detected}"
    echo "unknown_other_cause=${unknown_other_cause}"
    echo "review_comment_mode=${review_comment_mode}"
    echo "review_anchor_path=${review_anchor_path}"
  } >> "${GITHUB_OUTPUT}"

  write_multiline_output "diff_snippet" "${diff_snippet}"
}

build_diff_snippet() {
  local diff_file="$1"

  awk -v max_hunks="${snippet_max_hunks}" -v max_lines="${snippet_max_lines}" '
    BEGIN {
      hunk_count = 0
      line_count = 0
    }
    NR <= 2 {
      print
      line_count += 1
      next
    }
    /^@@/ {
      hunk_count += 1
      if (hunk_count > max_hunks) {
        exit
      }
    }
    {
      if (line_count >= max_lines) {
        exit
      }
      print
      line_count += 1
    }
  ' "${diff_file}"
}

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

dependency_manifest_changed='false'
dependency_manifest_anchor_path=''

if ! git -C "${repo_root}" diff --quiet "${base_commit}...HEAD" -- package.json; then
  dependency_manifest_changed='true'
  dependency_manifest_anchor_path='package.json'
fi

if ! git -C "${repo_root}" diff --quiet "${base_commit}...HEAD" -- pnpm-lock.yaml; then
  dependency_manifest_changed='true'
  dependency_manifest_anchor_path="${dependency_manifest_anchor_path:-pnpm-lock.yaml}"
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

committed_payload_types_changed='false'
if ! git -C "${repo_root}" diff --quiet "${base_commit}...HEAD" -- src/payload-types.ts; then
  committed_payload_types_changed='true'
fi

generated_diff_detected='false'
unknown_other_cause='false'
review_comment_mode='none'
review_anchor_path=''
diff_snippet=''

if [[ "${schema_config_changed}" == 'false' && "${dependency_manifest_changed}" == 'false' && "${committed_payload_types_changed}" == 'false' ]]; then
  emit_outputs
  echo "No Payload-related source, dependency, or committed payload type changes detected."

  if [[ -n "${summary_file}" ]]; then
    {
      echo "## Payload Types"
      echo "- Base ref: \`${base_ref}\`"
      echo "- Result: no Payload type comparison triggered."
    } >> "${summary_file}"
  fi

  exit 0
fi

tmp_dir="$(mktemp -d)"
base_worktree="${tmp_dir}/base-worktree"
base_types_file="${tmp_dir}/generated-base-payload-types.ts"
head_types_file="${tmp_dir}/generated-head-payload-types.ts"
full_diff_file="${tmp_dir}/generated-payload-types.diff"

cleanup() {
  git -C "${repo_root}" worktree remove --force "${base_worktree}" >/dev/null 2>&1 || true
  rm -rf "${tmp_dir}"
}

trap cleanup EXIT

git -C "${repo_root}" worktree add --detach "${base_worktree}" "${base_commit}" >/dev/null

if [[ "${dependency_manifest_changed}" == 'true' ]]; then
  echo "Installing base-commit dependencies for Payload type comparison..."
  (
    cd "${base_worktree}"
    pnpm install --frozen-lockfile
  )
else
  ln -s "${repo_root}/node_modules" "${base_worktree}/node_modules"
fi

echo "Generating Payload types for PR head..."
(
  cd "${repo_root}"
  PAYLOAD_TS_OUTPUT_PATH="${head_types_file}" pnpm run payload generate:types
)

echo "Generating Payload types for PR base..."
(
  cd "${base_worktree}"
  PAYLOAD_TS_OUTPUT_PATH="${base_types_file}" pnpm run payload generate:types
)

if diff -u \
  --label generated/base/payload-types.ts \
  --label generated/head/payload-types.ts \
  "${base_types_file}" \
  "${head_types_file}" > "${full_diff_file}"; then
  generated_diff_detected='false'
else
  diff_exit_code=$?

  if [[ "${diff_exit_code}" -ne 1 ]]; then
    exit "${diff_exit_code}"
  fi

  generated_diff_detected='true'
fi

if [[ "${generated_diff_detected}" == 'false' ]]; then
  emit_outputs
  echo "Compared CI-generated Payload types for base and head. No diff detected."

  if [[ -n "${summary_file}" ]]; then
    {
      echo "## Payload Types"
      echo "- Base ref: \`${base_ref}\`"
      echo "- Result: no CI-generated Payload type diff detected."
    } >> "${summary_file}"
  fi

  exit 0
fi

if [[ "${schema_config_changed}" == 'false' && "${payload_dependency_changed}" == 'false' ]]; then
  unknown_other_cause='true'
fi

if [[ -n "${schema_anchor_path}" ]]; then
  review_comment_mode='review'
  review_anchor_path="${schema_anchor_path}"
elif [[ -n "${payload_dependency_anchor_path}" ]]; then
  review_comment_mode='review'
  review_anchor_path="${payload_dependency_anchor_path}"
elif [[ -n "${dependency_manifest_anchor_path}" ]]; then
  review_comment_mode='review'
  review_anchor_path="${dependency_manifest_anchor_path}"
elif [[ "${committed_payload_types_changed}" == 'true' ]]; then
  review_comment_mode='review'
  review_anchor_path='src/payload-types.ts'
else
  review_comment_mode='sticky'
fi

diff_snippet="$(build_diff_snippet "${full_diff_file}")"

emit_outputs

echo "::notice::CI-generated Payload types differ between the PR base and head commits."

if [[ -n "${summary_file}" ]]; then
  {
    echo "## Payload Types"
    echo "- Base ref: \`${base_ref}\`"
    echo "- CI-generated diff detected: \`true\`"
    echo "- Review comment mode: \`${review_comment_mode}\`"
    echo "- Schema/config change: \`${schema_config_changed}\`"
    echo "- Payload dependency change: \`${payload_dependency_changed}\`"
    echo "- Unknown/other: \`${unknown_other_cause}\`"
    echo ""
    echo "<details><summary>CI-generated payload type diff</summary>"
    echo ""
    echo '```diff'
    cat "${full_diff_file}"
    echo '```'
    echo "</details>"
  } >> "${summary_file}"
fi
