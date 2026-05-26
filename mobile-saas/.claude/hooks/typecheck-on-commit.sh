#!/usr/bin/env bash
# Pre-tool hook: when a Bash tool call wraps a `git commit`, run `npx tsc --noEmit`
# first and block the commit on type errors. Same pattern as mobile/, web/, shared/
# in this repo.
#
# Hook input is JSON on stdin from Claude Code. We extract the command, check for
# `git commit`, and gate accordingly.

set -euo pipefail

# Hook input is JSON on stdin
input=$(cat)

# Extract the bash command being run (jq is on macOS by default via Homebrew)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Only act on `git commit` invocations
if [[ "$command" == *"git commit"* ]]; then
  echo "[typecheck-on-commit] running 'npx tsc --noEmit' before commit…" >&2
  if ! npx tsc --noEmit; then
    echo "" >&2
    echo "[typecheck-on-commit] ❌ TypeScript errors above — commit blocked." >&2
    echo "[typecheck-on-commit] Fix the errors and try again." >&2
    exit 2  # Exit 2 blocks the tool call (per Claude Code hook conventions)
  fi
  echo "[typecheck-on-commit] ✓ typecheck clean, proceeding to commit" >&2
fi

exit 0
