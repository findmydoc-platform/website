#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is required." >&2
  exit 1
fi

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  echo "GITHUB_OUTPUT is required." >&2
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

if "${deploy_command[@]}" >deployment-url.txt 2>error.txt; then
  deployment_url="$(cat deployment-url.txt)"
  echo "deploymentUrl=${deployment_url}" >> "$GITHUB_OUTPUT"
  echo "${label} deployment successful: ${deployment_url}"
  exit 0
fi

echo "There was an error during ${label} deployment:"
cat error.txt
exit 1
