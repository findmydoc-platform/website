#!/usr/bin/env bash
set -euo pipefail

if [[ ! "$CHANGED_COUNT" =~ ^(0|[1-9][0-9]{0,8})$ || ("$CHANGED" == false && "$CHANGED_COUNT" != 0) || ("$CHANGED" == true && "$CHANGED_COUNT" == 0) ]]; then
  echo '::error::Native changed-file count is invalid. No omission is approved.'
  exit 1
fi
if [[ "$EVENT_NAME" == pull_request ]]; then
  if [[ ! "$PR_CHANGED_COUNT" =~ ^(0|[1-9][0-9]{0,8})$ ]] || (( PR_CHANGED_COUNT <= 3000 && (CHANGED_COUNT < PR_CHANGED_COUNT || CHANGED_COUNT > 2 * PR_CHANGED_COUNT) )); then
    echo '::error::Native changed-file evidence is incomplete. No omission is approved.'
    exit 1
  fi
  # The PR API caps file discovery at 3000; renamed files expand into two native paths.
  if (( PR_CHANGED_COUNT > 3000 )); then
    echo '::error::PR exceeds the native API discovery limit. No omission is approved.'
    exit 1
  fi
fi
