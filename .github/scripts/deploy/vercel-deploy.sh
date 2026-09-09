#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
max_attempts="${VERCEL_DEPLOY_MAX_ATTEMPTS:-3}"
retry_delay_seconds="${VERCEL_DEPLOY_RETRY_DELAY_SECONDS:-10}"

validate_deployment_metadata() {
  if [[ "${DEPLOYMENT_ENVIRONMENT:-}" != "${target}" ]]; then
    echo "DEPLOYMENT_ENVIRONMENT must equal the deployment target '${target}'." >&2
    exit 1
  fi

  if ! [[ "${DEPLOYMENT_COMMIT_SHA:-}" =~ ^[0-9a-f]{40}$ ]]; then
    echo "DEPLOYMENT_COMMIT_SHA must be a full lowercase 40-character SHA." >&2
    exit 1
  fi

  case "${target}" in
    preview)
      if [[ -n "${RELEASE_VERSION+x}" ]]; then
        echo "RELEASE_VERSION must be unset for Preview deployments." >&2
        exit 1
      fi
      ;;
    production)
      if ! [[ "${RELEASE_VERSION:-}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
        echo "RELEASE_VERSION must be a vX.Y.Z version for Production deployments." >&2
        exit 1
      fi
      ;;
  esac
}

validate_pulled_preview_environment() {
  local environment_file=".vercel/.env.preview.local"

  if [[ ! -f "${environment_file}" ]]; then
    echo "Pulled Preview environment file is required before deployment." >&2
    exit 1
  fi

  if command -v rg >/dev/null 2>&1; then
    if rg -q '^[[:space:]]*(export[[:space:]]+)?RELEASE_VERSION[[:space:]]*=' "${environment_file}"; then
      echo "Pulled Preview environment must not define RELEASE_VERSION." >&2
      exit 1
    fi
    return 0
  fi

  if grep -Eq '^[[:space:]]*(export[[:space:]]+)?RELEASE_VERSION[[:space:]]*=' "${environment_file}"; then
    echo "Pulled Preview environment must not define RELEASE_VERSION." >&2
    exit 1
  fi
}

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is required." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "${script_dir}/assert-vercel-project-binding.sh"

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
  preview | production) ;;
  *)
    echo "Unsupported target '${target}'. Use 'preview' or 'production'." >&2
    exit 1
    ;;
esac

validate_deployment_metadata

case "${target}" in
  preview)
    validate_pulled_preview_environment

    if [[ -z "${DATABASE_DIRECT_URI:-}" ]]; then
      echo "DATABASE_DIRECT_URI is required to build a Preview deployment." >&2
      exit 1
    fi

    echo "Building Preview deployment in the GitHub runner..."
    pnpm dlx vercel@canary build --target preview --yes
    deploy_command=(pnpm dlx vercel@canary deploy --prebuilt --target preview --yes)
    label="Preview"
    ;;
  production)
    deploy_command=(pnpm dlx vercel@canary deploy --prod)
    label="Production"
    ;;
  *)
    echo "Unsupported target '${target}'. Use 'preview' or 'production'." >&2
    exit 1
    ;;
esac

deploy_command+=(
  --build-env "DEPLOYMENT_ENVIRONMENT=${DEPLOYMENT_ENVIRONMENT}"
  --build-env "DEPLOYMENT_COMMIT_SHA=${DEPLOYMENT_COMMIT_SHA}"
  --env "DEPLOYMENT_ENVIRONMENT=${DEPLOYMENT_ENVIRONMENT}"
  --env "DEPLOYMENT_COMMIT_SHA=${DEPLOYMENT_COMMIT_SHA}"
)

if [[ "${target}" == "production" ]]; then
  deploy_command+=(
    --build-env "RELEASE_VERSION=${RELEASE_VERSION}"
    --env "RELEASE_VERSION=${RELEASE_VERSION}"
  )
fi

if [[ "${target}" == "production" && -n "${PAYLOAD_SECRET:-}" ]]; then
  deploy_command+=(--build-env "PAYLOAD_SECRET=${PAYLOAD_SECRET}" --env "PAYLOAD_SECRET=${PAYLOAD_SECRET}")
fi

if [[ "${target}" == "production" && -n "${DATABASE_URI:-}" ]]; then
  deploy_command+=(--build-env "DATABASE_URI=${DATABASE_URI}" --env "DATABASE_URI=${DATABASE_URI}")
fi

deploy_output_file="$(mktemp)"
deploy_error_file="$(mktemp)"
trap 'rm -f "${deploy_output_file}" "${deploy_error_file}"' EXIT

extract_deployment_url() {
  local file_path="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -o 'https://[[:alnum:].-]+\.vercel\.app' "${file_path}" | tail -n 1 || true
    return 0
  fi

  grep -Eo 'https://[[:alnum:].-]+\.vercel\.app' "${file_path}" | tail -n 1 || true
}

is_transient_vercel_error() {
  local file_path="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -qi 'internal error|please try again' "${file_path}"
    return $?
  fi

  grep -Eqi 'internal error|please try again' "${file_path}"
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
