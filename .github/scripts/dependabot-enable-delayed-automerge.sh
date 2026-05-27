#!/usr/bin/env bash
set -euo pipefail

label="${AUTOMERGE_LABEL:-automerge:dependencies}"
minimum_age_hours="${MINIMUM_AGE_HOURS:-48}"

if ! [[ "$minimum_age_hours" =~ ^[0-9]+$ ]]; then
  echo "MINIMUM_AGE_HOURS must be a non-negative integer" >&2
  exit 1
fi

gh label create "$label" \
  --description "Dependency PRs eligible for delayed auto-merge" \
  --color "0E8A16" \
  --force

prs_json="$(
  gh pr list \
    --author "app/dependabot" \
    --base "main" \
    --state "open" \
    --label "$label" \
    --json "autoMergeRequest,createdAt,isDraft,number,title" \
    --limit 100
)"

if [ "$(jq 'length' <<< "$prs_json")" -eq 0 ]; then
  echo "No delayed Dependabot auto-merge candidates found."
  exit 0
fi

now_epoch="$(date -u +%s)"

jq -c '.[]' <<< "$prs_json" | while read -r pr; do
  number="$(jq -r '.number' <<< "$pr")"
  title="$(jq -r '.title' <<< "$pr")"
  created_at="$(jq -r '.createdAt' <<< "$pr")"
  created_epoch="$(date -u -d "$created_at" +%s)"
  age_hours="$(((now_epoch - created_epoch) / 3600))"

  if [ "$(jq -r '.isDraft' <<< "$pr")" = "true" ]; then
    echo "Skipping #$number because it is a draft: $title"
    continue
  fi

  if [ "$(jq -r '.autoMergeRequest != null' <<< "$pr")" = "true" ]; then
    echo "Skipping #$number because auto-merge is already enabled: $title"
    continue
  fi

  if [ "$age_hours" -lt "$minimum_age_hours" ]; then
    echo "Skipping #$number because it is ${age_hours}h old; requires ${minimum_age_hours}h: $title"
    continue
  fi

  echo "Enabling auto-merge for #$number (${age_hours}h old): $title"
  gh pr merge --auto --squash "$number"
done
