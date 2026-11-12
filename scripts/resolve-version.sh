#!/usr/bin/env bash
# Decides which kedgeway to run. Usage: resolve-version.sh <action_ref> [version_input]
# Prints a bare semver (install that version from npm) or the word "source" (build the checked-out code).
# The explicit input wins over the ref. An invalid explicit input is an error (exit 1), never a silent
# fallback; an unrecognised ref (branch, SHA, empty for the local `./`) means "source".
set -euo pipefail

ref="${1-}"
input="${2-}"
semver='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'

if [ -n "$input" ]; then
  if [ "$input" = "source" ]; then
    echo source
    exit 0
  fi
  candidate="${input#v}"
  if [[ "$candidate" =~ $semver ]]; then
    echo "$candidate"
    exit 0
  fi
  echo "::error title=kedgeway::Invalid 'version' input. Use a semver such as 1.2.3 (optionally prefixed with v) or 'source'." >&2
  exit 1
fi

candidate="${ref#v}"
if [[ "$candidate" =~ $semver ]]; then
  echo "$candidate"
else
  echo source
fi
