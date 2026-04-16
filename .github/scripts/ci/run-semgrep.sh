#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"
semgrep_bin="${SEMGREP_BIN:-semgrep}"

# Keep this list to low-noise packs that already pass on this repository.
configs=(
  p/javascript
  p/owasp-top-ten
  "${repo_root}/.github/semgrep/js-ts-community.yml"
)

args=()
for config in "${configs[@]}"; do
  args+=(--config "${config}")
done

"${semgrep_bin}" scan --error --metrics=off "${args[@]}" "${repo_root}"
