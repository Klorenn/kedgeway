import { access } from "node:fs/promises";

const required = ["dist/cli.js", "dist/index.js", "dist/index.d.ts"];
const missing = [];
for (const f of required) {
  try {
    await access(f);
  } catch {
    missing.push(f);
  }
}
if (missing.length > 0) {
  console.error(`check-dist: missing build output: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("check-dist: ok");
