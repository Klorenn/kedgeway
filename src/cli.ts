#!/usr/bin/env node
import { runCli } from "./cli/commands.js";
import { AuthStore } from "./adapters/raven-auth.js";
import { runStdioServer } from "./mcp/server.js";
import { createRavenEcosystem } from "./sdk.js";
import { RavenEcosystem, loginToRaven } from "./adapters/raven-ecosystem.js";

const code = await runCli(process.argv, {
  stdout: (s) => void process.stdout.write(s),
  stderr: (s) => void process.stderr.write(s),
  createRavenPort: () => new RavenEcosystem(),
  login: () => loginToRaven(),
  logout: () => new AuthStore().clear(),
  startMcp: ({ allowWrite }) =>
    runStdioServer({ ecosystem: createRavenEcosystem({ interactive: false }), allowWrite }),
});
process.exitCode = code; // let stdout drain; do not call process.exit()
