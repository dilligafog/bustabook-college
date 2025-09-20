#!/usr/bin/env bash
set -euo pipefail

# Cronicle Shell Plugin JSON status + app workflow runner
# - Emits JSON lines for progress/completion
# - Runs project commands as user 'bustabook' with ODDS_API_KEY preserved

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_AS_USER="bustabook"

# Helper to write compact single-line JSON to stdout for Cronicle
json_line() {
  local payload="$1"
  printf '%s\n' "$payload"
}

# Run a command as the target user with a login shell and repo cwd
run_as_user() {
  local cmd="$1"
  sudo --preserve-env=ODDS_API_KEY -u "$RUN_AS_USER" bash -lc "cd '$REPO_ROOT' && $cmd"
}

echo "Starting Cronicle job at $(date -u +'%Y-%m-%d %H:%M:%S %Z')"
json_line '{"progress": 0.05}'

# Step 1: Fetch latest scores
echo "Fetching scores via The Odds API..."
if ! run_as_user "python3 scripts/fetch_scores.py"; then
  json_line '{"complete":1,"code":1,"description":"fetch_scores failed"}'
  exit 1
fi
json_line '{"progress": 0.35}'

# Step 2: Build manifest and ingest scores into all-scores
echo "Building manifest and ingesting scores..."
if ! run_as_user "node build-manifest.js"; then
  json_line '{"complete":1,"code":2,"description":"build-manifest failed"}'
  exit 2
fi
json_line '{"progress": 0.60}'

# Step 3: Commit and push changes (if any)
echo "Committing and pushing repo changes (if any)..."
run_as_user "git add -A"
if run_as_user "git diff --cached --quiet"; then
  echo "No changes to commit."
else
  COMMIT_MSG="chore(scores): update $(date -u +'%Y-%m-%d %H:%M:%S %Z')"
  if ! run_as_user "git commit -m \"$COMMIT_MSG\""; then
    json_line '{"complete":1,"code":3,"description":"git commit failed"}'
    exit 3
  fi
  if ! run_as_user "git push"; then
    json_line '{"complete":1,"code":4,"description":"git push failed"}'
    exit 4
  fi
  echo "Pushed changes successfully."
fi
json_line '{"progress": 0.95}'

echo "Cronicle job complete."
json_line '{"complete":1,"code":0}'
