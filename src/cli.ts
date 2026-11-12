#!/usr/bin/env node
import { runCli } from "./cli/commands.js";
import { writeFile } from "node:fs/promises";
import { AuthStore, exportAuth } from "./adapters/raven-auth.js";
import { runStdioServer } from "./mcp/server.js";
import { createRavenEcosystem } from "./sdk.js";
import { RavenEcosystem, loginToRaven } from "./adapters/raven-ecosystem.js";

const code = await runCli(process.argv, {
  stdout: (s) => void process.stdout.write(s),
  stderr: (s) => void process.stderr.write(s),
  createRavenPort: () => new RavenEcosystem(),
  login: (opts) => loginToRaven(new AuthStore(), opts),
  logout: () => new AuthStore().clear(),
  exportAuth: () => exportAuth(new AuthStore()),
  writeFile: (path, text) => writeFile(path, text, "utf8"),
  startMcp: ({ allowWrite }) =>
    runStdioServer({ ecosystem: createRavenEcosystem({ interactive: false }), allowWrite }),
});
process.exitCode = code; // let stdout drain; do not call process.exit()
