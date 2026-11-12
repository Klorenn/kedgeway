#!/usr/bin/env bash
# Runs `kedgeway diagnose` (KW_MODE=diagnose, the default) or `kedgeway pr` (KW_MODE=pr) exactly once and exposes the results as step outputs.
# Inputs come from the environment (set by action.yml): KW_MODE, KW_PATH, KW_REPO, KW_FAIL_ON, KW_FIXTURE, KW_AUTH, KW_JSON, KW_SARIF, KW_ANNOTATIONS, KW_CLI,
# and for mode pr: KW_PR_BASE, KW_PR_BRANCH, KW_PR_DRAFT, KW_REFRESH_LOCKFILES, KW_TOKEN.
set -uo pipefail

if [ -z "${KW_FIXTURE:-}" ] && [ -z "${KW_AUTH:-}" ]; then
  echo "::error title=kedgeway::Set either the 'fixture' input (a committed ecosystem snapshot JSON) or the 'auth' input (a secret created with \`kedgeway login --export\`). See the README, GitHub Action section."
  exit 1
fi

mode="${KW_MODE:-diagnose}"
case "$mode" in
  diagnose | pr) ;;
  *) echo "::error title=kedgeway::The 'mode' input must be 'diagnose' or 'pr'."; exit 1 ;;
esac

if [ "$mode" = "pr" ]; then
  if [ -n "${KW_REPO:-}" ]; then
    echo "::error title=kedgeway::The 'repo' input is not supported with mode: pr (a pull request needs a local checkout)."
    exit 1
  fi
  pr_path="${KW_PATH:-.}"
  case "$pr_path" in
    -*) echo "::error title=kedgeway::The 'path' input must be a directory, not an option."; exit 1 ;;
  esac
  pr_report="${RUNNER_TEMP:?RUNNER_TEMP is required}/kedgeway-pr.json"
  args=(pr "$pr_path" --json)
  if [ -n "${KW_FIXTURE:-}" ]; then
    args+=(--fixture "$KW_FIXTURE")
  else
    export KEDGEWAY_AUTH="$KW_AUTH"
  fi
  if [ -n "${KW_PR_BASE:-}" ]; then args+=(--base "$KW_PR_BASE"); fi
  if [ -n "${KW_PR_BRANCH:-}" ]; then args+=(--branch "$KW_PR_BRANCH"); fi
  if [ "${KW_PR_DRAFT:-false}" = "true" ]; then args+=(--draft); fi
  if [ "${KW_REFRESH_LOCKFILES:-false}" = "true" ]; then args+=(--refresh-lockfiles); fi
  # The token reaches the CLI through the environment only, never argv. GITHUB_REPOSITORY comes from the runner.
  if [ -n "${KW_TOKEN:-}" ]; then export GITHUB_TOKEN="$KW_TOKEN"; fi

  node "$KW_CLI" "${args[@]}" > "$pr_report"
  code=$?
  if [ "$code" -ne 0 ]; then exit "$code"; fi

  # The JSON comes from our own CLI, but url/title/reason carry repo- and API-derived text: one line per field, and
  # never a line starting with "::" (workflow command) or a newline inside a step output.
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const c=s=>String(s==null?"":s).replace(/[\r\n]+/g," ");fs.appendFileSync(process.env.GITHUB_OUTPUT,"pr-action="+c(j.action)+"\npr-url="+c(j.url)+"\nreport-json="+process.argv[1]+"\n");const line="kedgeway pr: "+c(j.action)+(j.url?" "+c(j.url):"")+(j.reason?" ("+c(j.reason)+")":"");console.log(line.startsWith("::")?" "+line:line)' "$pr_report" || exit 1
  if [ "${KW_JSON:-false}" = "true" ]; then cat "$pr_report" || exit 1; fi
  exit 0
fi

report="${RUNNER_TEMP:?RUNNER_TEMP is required}/kedgeway-report.json"
target="${KW_PATH:-.}"
if [ -n "${KW_REPO:-}" ]; then
  case "$KW_REPO" in
    -*) echo "::error title=kedgeway::The 'repo' input must be a URL or owner/repo, not an option."; exit 1 ;;
  esac
  target="$KW_REPO" # a remote source: the CLI clones it (shallow, temp dir) and validates it
fi
annotations_file=""
if [ -n "${KW_REPO:-}" ]; then
  : # annotations carry repo-relative paths that do not exist in this checkout, so none are emitted for a remote repo
elif [ "${KW_ANNOTATIONS:-}" = "true" ] || { [ -z "${KW_ANNOTATIONS:-}" ] && [ "${GITHUB_ACTIONS:-}" = "true" ]; }; then
  annotations_file="${RUNNER_TEMP:?RUNNER_TEMP is required}/kedgeway-annotations.txt"
fi
args=(diagnose "$target" --json)
if [ -n "$annotations_file" ]; then args+=(--annotations "$annotations_file"); fi
if [ -n "${KW_FIXTURE:-}" ]; then
  args+=(--fixture "$KW_FIXTURE") # offline: the auth secret is not needed, so it is not exported
else
  export KEDGEWAY_AUTH="$KW_AUTH"
fi
if [ -n "${KW_FAIL_ON:-}" ]; then args+=(--fail-on "$KW_FAIL_ON"); fi
sarif=""
if [ "${KW_SARIF:-false}" = "true" ]; then
  sarif="${RUNNER_TEMP}/kedgeway.sarif"
  args+=(--sarif "$sarif")
fi

node "$KW_CLI" "${args[@]}" > "$report"
code=$?

# 0 = ok, 2 = fail-on tripped (report is valid); anything else is a tool error.
if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then
  exit "$code"
fi

summary=$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=d.summary;console.log("critical="+s.critical+" warning="+s.warning+" info="+s.info)' "$report") || exit 1
{
  echo "summary=$summary"
  echo "report-json=$report"
  if [ -n "$sarif" ] && [ -f "$sarif" ]; then echo "sarif=$sarif"; fi
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

# Workflow commands go to stdout first so the runner turns them into annotations.
if [ -n "$annotations_file" ] && [ -s "$annotations_file" ]; then cat "$annotations_file" || exit 1; fi

if [ "${KW_JSON:-false}" = "true" ]; then
  cat "$report" || exit 1
else
  # Finding text is untrusted (it can contain manifest-derived strings): keep it on one line per field and make
  # sure no output line starts with "::" so it can never be read as a workflow command.
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const c=s=>String(s).replace(/[\r\n]+/g," ");const out=[];for(const f of d.findings){out.push("["+c(f.severity).toUpperCase()+"] "+c(f.code)+"  "+c(f.file));out.push("  "+c(f.message))}out.push("","Summary: "+process.argv[2]);console.log(out.map(l=>l.startsWith("::")?" "+l:l).join("\n"))' "$report" "$summary" || exit 1
fi
exit "$code"
