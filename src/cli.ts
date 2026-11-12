#!/usr/bin/env node
import { runCli } from "./cli/commands.js";
import { writeFile } from "node:fs/promises";
import { runDoctor } from "./adapters/doctor.js";
import { SnapshotCache } from "./adapters/snapshot-cache.js";
import { AuthStore, defaultAuthPath, exportAuth, readOnlyAuthStore } from "./adapters/raven-auth.js";
import { readPackageVersion } from "./adapters/package-version.js";
import { writeWorkflow } from "./adapters/workflow-writer.js";
import { readLine } from "./adapters/stdin-prompt.js";
import { runStdioServer } from "./mcp/server.js";
import { createRavenEcosystem } from "./sdk.js";
import { RavenEcosystem, loginToRaven, pingRaven } from "./adapters/raven-ecosystem.js";

const code = await runCli(process.argv, {
  stdout: (s) => void process.stdout.write(s),
  stderr: (s) => void process.stderr.write(s),
  createRavenPort: () => new RavenEcosystem(),
  login: (opts) =>
    loginToRaven(new AuthStore(), {
      ...(opts?.preserve ? { preserve: true } : {}),
      ...(opts?.noBrowser ? { noBrowser: { manualCode: (signal) => readLine(signal, {
                prompt: "Paste the redirect URL or code, then press Enter: ",
                notice: "kedgeway: stdin is not a terminal, so pasting is disabled; waiting for the browser callback on 127.0.0.1 only (for a remote machine forward the port first: ssh -L <port>:127.0.0.1:<port> <host>).\n",
              }) } } : {}),
    }),
  logout: () => new AuthStore().clear(),
  exportAuth: () => exportAuth(new AuthStore()),
  doctor: (opts) =>
    runDoctor(
      {
        nodeVersion: process.versions.node,
        env: process.env,
        authPath: defaultAuthPath(),
        cache: new SnapshotCache(),
        now: Date.now,
        ping: async () => pingRaven(await readOnlyAuthStore()), // read-only: a token refresh must not touch auth.json
      },
      opts,
    ),
  writeFile: (path, text) => writeFile(path, text, "utf8"),
  version: await readPackageVersion(),
  writeWorkflow,
  startMcp: ({ allowWrite }) =>
    runStdioServer({ ecosystem: createRavenEcosystem({ interactive: false }), allowWrite }),
});
process.exitCode = code; // let stdout drain; do not call process.exit()
