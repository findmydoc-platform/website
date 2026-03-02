#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
max_attempts="${VERCEL_DEPLOY_MAX_ATTEMPTS:-3}"
retry_delay_seconds="${VERCEL_DEPLOY_RETRY_DELAY_SECONDS:-10}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is required." >&2
  exit 1
fi

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  echo "GITHUB_OUTPUT is required." >&2
  exit 1
fi

if ! [[ "${max_attempts}" =~ ^[0-9]+$ ]] || [[ "${max_attempts}" -lt 1 ]]; then
  echo "VERCEL_DEPLOY_MAX_ATTEMPTS must be a positive integer." >&2
  exit 1
fi

if ! [[ "${retry_delay_seconds}" =~ ^[0-9]+$ ]]; then
  echo "VERCEL_DEPLOY_RETRY_DELAY_SECONDS must be a non-negative integer." >&2
  exit 1
fi

case "${target}" in
  preview)
    deploy_command=(pnpm dlx vercel@canary deploy --target preview --token="${VERCEL_TOKEN}")
    label="Preview"
    ;;
  production)
    deploy_command=(pnpm dlx vercel@canary deploy --prod --token="${VERCEL_TOKEN}")
    label="Production"
    ;;
  *)
    echo "Unsupported target '${target}'. Use 'preview' or 'production'." >&2
    exit 1
    ;;
esac

deploy_output_file="$(mktemp)"
deploy_error_file="$(mktemp)"
trap 'rm -f "${deploy_output_file}" "${deploy_error_file}"' EXIT

extract_deployment_url() {
  local file_path="$1"
  rg -o 'https://[[:alnum:].-]+\.vercel\.app' "${file_path}" | tail -n 1 || true
}

is_transient_vercel_error() {
  local file_path="$1"
  rg -qi 'internal error|please try again' "${file_path}"
}

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  echo "${label} deployment attempt ${attempt}/${max_attempts}..."

  if "${deploy_command[@]}" >"${deploy_output_file}" 2>"${deploy_error_file}"; then
    deployment_url="$(extract_deployment_url "${deploy_output_file}")"
    if [[ -z "${deployment_url}" ]]; then
      echo "Could not parse deployment URL from Vercel output:" >&2
      cat "${deploy_output_file}" >&2
      exit 1
    fi

    echo "deploymentUrl=${deployment_url}" >> "$GITHUB_OUTPUT"
    echo "${label} deployment successful: ${deployment_url}"
    exit 0
  fi

  echo "There was an error during ${label} deployment (attempt ${attempt}/${max_attempts}):"
  cat "${deploy_error_file}"

  if [[ "${attempt}" -lt "${max_attempts}" ]] && is_transient_vercel_error "${deploy_error_file}"; then
    wait_seconds=$((retry_delay_seconds * attempt))
    echo "Detected transient Vercel platform error, retrying in ${wait_seconds}s..."
    sleep "${wait_seconds}"
    continue
  fi

  exit 1
done

exit 1
