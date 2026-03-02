#!/usr/bin/env bash
set -euo pipefail

service_id="${1:-}"

if [[ -z "${service_id}" ]]; then
  echo "Postgres service id is required." >&2
  exit 1
fi

echo "Waiting for PostgreSQL service container to become healthy..."
for i in {1..30}; do
  status="$(docker inspect --format '{{.State.Health.Status}}' "${service_id}")"
  if [[ "${status}" == "healthy" ]]; then
    echo "PostgreSQL is healthy!"
    exit 0
  fi

  echo "Attempt ${i}: PostgreSQL status is '${status}'. Waiting 2 seconds..."
  sleep 2
done

echo "Error: PostgreSQL did not become healthy in time."
docker inspect "${service_id}" || true
exit 1
