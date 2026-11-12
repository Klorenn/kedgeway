import { access, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve relative to this script (not the cwd); an explicit root can be passed for testing.
const root = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = ["dist/cli.js", "dist/index.js", "dist/index.d.ts", "dist/sdk.js", "dist/mcp/server.js"];

const problems = [];
for (const f of required) {
  try {
    await access(join(root, f));
  } catch {
    problems.push(`missing ${f}`);
  }
}

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

for (const f of await walk(join(root, "dist"))) {
  if (/\.test\.[cm]?[jt]s(\.map)?$|\.test\.d\.ts$/.test(f)) problems.push(`test file in dist: ${f.slice(root.length + 1)}`);
}

if (problems.length > 0) {
  console.error(`check-dist: ${problems.join("; ")}`);
  process.exit(1);
}
console.log("check-dist: ok");
