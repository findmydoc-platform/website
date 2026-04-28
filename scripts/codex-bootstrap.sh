#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${CODEX_BOOTSTRAP_ENV_FILE:-$ROOT_DIR/.codex/environments/bootstrap.env}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

REMOTE_NAME="${CODEX_GIT_REMOTE:-origin}"
BASE_BRANCH="${CODEX_GIT_BASE_BRANCH:-main}"
INSTALL_COMMAND="${CODEX_INSTALL_COMMAND:-pnpm install}"
SYNC_MODE="${CODEX_GIT_SYNC_MODE:-rebase}"

git_cmd() {
  git -C "$ROOT_DIR" "$@"
}

resolve_dir() {
  local path="$1"

  if [ -d "$path" ]; then
    (
      cd "$path"
      pwd -P
    )
    return
  fi

  (
    cd "$ROOT_DIR/$path"
    pwd -P
  )
}

has_worktree_changes() {
  [ -n "$(git_cmd status --porcelain)" ]
}

ensure_clean_for_sync() {
  local context="$1"

  if has_worktree_changes; then
    echo "Working tree has local changes. Commit, stash, or clean them before $context." >&2
    exit 1
  fi
}

seed_worktree_env() {
  local destination="$ROOT_DIR/.env"
  local primary_source="$MAIN_REPO_ROOT/.env"
  local fallback_source="$ROOT_DIR/.env.example"

  if [ -f "$destination" ]; then
    return
  fi

  if [ -f "$primary_source" ]; then
    cp "$primary_source" "$destination"
    echo "Seeded worktree .env from main repository."
    return
  fi

  if [ -f "$fallback_source" ]; then
    cp "$fallback_source" "$destination"
    echo "Seeded worktree .env from .env.example."
    return
  fi

  echo "No .env source found. Expected $primary_source or $fallback_source." >&2
  exit 1
}

GIT_DIR="$(resolve_dir "$(git_cmd rev-parse --git-dir)")"
GIT_COMMON_DIR="$(resolve_dir "$(git_cmd rev-parse --git-common-dir)")"
MAIN_REPO_ROOT="$(cd "$GIT_COMMON_DIR/.." && pwd -P)"
IS_LINKED_WORKTREE=false
CURRENT_BRANCH="$(git_cmd branch --show-current || true)"

if [ "$GIT_DIR" != "$GIT_COMMON_DIR" ]; then
  IS_LINKED_WORKTREE=true
fi

git_cmd fetch "$REMOTE_NAME" "$BASE_BRANCH"

if [ -z "$CURRENT_BRANCH" ]; then
  if [ "$IS_LINKED_WORKTREE" != true ]; then
    echo "Detached HEAD is only supported in linked worktrees." >&2
    exit 1
  fi

  ensure_clean_for_sync "moving the detached worktree to $REMOTE_NAME/$BASE_BRANCH"

  CURRENT_HEAD="$(git_cmd rev-parse HEAD)"
  TARGET_HEAD="$(git_cmd rev-parse "$REMOTE_NAME/$BASE_BRANCH")"

  if [ "$CURRENT_HEAD" = "$TARGET_HEAD" ]; then
    echo "Detached worktree already points at $REMOTE_NAME/$BASE_BRANCH."
  else
    git_cmd checkout --detach "$REMOTE_NAME/$BASE_BRANCH"
    echo "Updated detached worktree to $REMOTE_NAME/$BASE_BRANCH."
  fi
elif [ "$CURRENT_BRANCH" = "$BASE_BRANCH" ]; then
  git_cmd pull --ff-only "$REMOTE_NAME" "$BASE_BRANCH"
else
  ensure_clean_for_sync "syncing branch $CURRENT_BRANCH with $REMOTE_NAME/$BASE_BRANCH"

  case "$SYNC_MODE" in
    rebase)
      git_cmd rebase "$REMOTE_NAME/$BASE_BRANCH"
      ;;
    ff-only)
      git_cmd merge --ff-only "$REMOTE_NAME/$BASE_BRANCH"
      ;;
    none)
      echo "Skipping feature-branch sync because CODEX_GIT_SYNC_MODE=none."
      ;;
    *)
      echo "Unsupported CODEX_GIT_SYNC_MODE: $SYNC_MODE" >&2
      exit 1
      ;;
  esac
fi

if [ "$IS_LINKED_WORKTREE" = true ]; then
  seed_worktree_env
fi

eval "$INSTALL_COMMAND"
