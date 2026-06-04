#!/usr/bin/env bash
# PreToolUse hook: typecheck before `git commit`.
# Reads the tool call JSON on stdin, extracts the bash command,
# runs `tsc --noEmit` if the command contains `git commit`,
# and exits 2 (blocking) on typecheck failure.

set -euo pipefail

CMD=$(jq -r '.tool_input.command // empty')

if echo "$CMD" | grep -qE '(^|[^a-zA-Z])git[[:space:]]+commit'; then
  cd "$CLAUDE_PROJECT_DIR"
  if ! npx --no-install tsc --noEmit; then
    echo "tsc --noEmit failed — fix type errors before committing." >&2
    exit 2
  fi
fi

exit 0
