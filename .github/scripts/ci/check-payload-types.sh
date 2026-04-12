#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"
source_file="${repo_root}/src/payload-types.ts"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

generated_file="${tmp_dir}/payload-types.ts"

echo "Generating Payload types into a temporary file..."
PAYLOAD_TS_OUTPUT_PATH="${generated_file}" pnpm run payload generate:types

if git -C "${repo_root}" diff --no-index --quiet -- "${source_file}" "${generated_file}"; then
  echo "Payload types are up to date."
  exit 0
fi

echo "::error::src/payload-types.ts is out of date. Regenerate it with pnpm run payload generate:types and commit the result."
git -C "${repo_root}" diff --no-index -- "${source_file}" "${generated_file}" || true
exit 1
