import { readFile } from "node:fs/promises";

/** Version from package.json. src/adapters and dist/adapters both sit two levels below the package root. */
export async function readPackageVersion(): Promise<string> {
  const url = new URL("../../package.json", import.meta.url);
  const pkg = JSON.parse(await readFile(url, "utf8")) as { version?: unknown };
  if (typeof pkg.version !== "string") throw new Error("package.json has no version");
  return pkg.version;
}
