#!/usr/bin/env bash
# Runs `kedgeway diagnose` exactly once and exposes the results as step outputs.
# Inputs come from the environment (set by action.yml): KW_PATH, KW_FAIL_ON, KW_FIXTURE, KW_AUTH, KW_JSON, KW_SARIF, KW_ANNOTATIONS, KW_CLI.
set -uo pipefail

if [ -z "${KW_FIXTURE:-}" ] && [ -z "${KW_AUTH:-}" ]; then
  echo "::error title=kedgeway::Set either the 'fixture' input (a committed ecosystem snapshot JSON) or the 'auth' input (a secret created with \`kedgeway login --export\`). See the README, GitHub Action section."
  exit 1
fi

report="${RUNNER_TEMP:?RUNNER_TEMP is required}/kedgeway-report.json"
annotations_file=""
if [ "${KW_ANNOTATIONS:-}" = "true" ] || { [ -z "${KW_ANNOTATIONS:-}" ] && [ "${GITHUB_ACTIONS:-}" = "true" ]; }; then
  annotations_file="${RUNNER_TEMP:?RUNNER_TEMP is required}/kedgeway-annotations.txt"
fi
args=(diagnose "${KW_PATH:-.}" --json)
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
if [ -n "$annotations_file" ] && [ -s "$annotations_file" ]; then cat "$annotations_file"; fi

if [ "${KW_JSON:-false}" = "true" ]; then
  cat "$report"
else
  # Finding text is untrusted (it can contain manifest-derived strings): keep it on one line per field and make
  # sure no output line starts with "::" so it can never be read as a workflow command.
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const c=s=>String(s).replace(/[\r\n]+/g," ");const out=[];for(const f of d.findings){out.push("["+c(f.severity).toUpperCase()+"] "+c(f.code)+"  "+c(f.file));out.push("  "+c(f.message))}out.push("","Summary: "+process.argv[2]);console.log(out.map(l=>l.startsWith("::")?" "+l:l).join("\n"))' "$report" "$summary"
fi
exit "$code"
