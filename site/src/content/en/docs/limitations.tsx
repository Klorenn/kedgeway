import type { DocsLimitationsDict } from "../../schema/docs-limitations";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "Limitations — kedgeway docs", description: "What kedgeway does not do, so you can judge its output." },
  h1: "Limitations",
  lede: <>kedgeway says what it does not know. These are the gaps to keep in mind.</>,
  note: <>A clean report is evidence about declared versions only. It is not a security review of your contracts.</>,
  items: {
    lockfile: { term: "Lockfile parsing is limited", detail: <>Cargo.lock, package-lock.json, pnpm-lock.yaml and yarn.lock are read; pnpm and yarn with a minimal parser, so unusual layouts fall back to the manifest version. Nothing above the scan root is read. The parsers are tested on seven real lockfiles from public repositories, which is a corpus, not a guarantee: a layout it has not seen can fall back to the manifest. JS ranges use <code>semver</code>; Cargo requirements use a custom matcher.</> },
    annotations: { term: "Annotations are best effort", detail: <>The line in an annotation comes from a plain scan of the manifest (the first matching key), so it can point at the wrong line in an unusual file. Findings that are not about a file have no location. GitHub shows at most 10 annotations per type per step and 50 per job; the full report is always printed.</> },
    deviceCode: { term: "No device-code login", detail: <>Stellar Raven offers authorization code and refresh tokens only. On a server, use <code>kedgeway login --no-browser</code> and paste the redirect back, or forward the callback port with <code>ssh -L</code>.</> },
    sample: { term: "The deprecated list is a sample", detail: <>Scout&apos;s deprecated sample is capped at 50. A version missing from it is not proof that it is supported. kedgeway also treats anything more than one major behind as deprecated.</> },
    docsPage: { term: "Current versions come from a docs page", detail: <>They are read from the official Software Versions page. If that page changes shape, parsing can fail, and the report says so with DATA_DEGRADED.</> },
    raven: { term: "Raven must be reachable", detail: <>A live run needs network access and a valid Raven sign-in. Offline, use <code>--offline</code> (the cached snapshot) or <code>--fixture</code>. For CI, export the login into a <code>KEDGEWAY_AUTH</code> secret; it can go stale if Raven rotates refresh tokens.</> },
    migration: { term: "Migration is narrow", detail: <><code>kedgeway migrate</code> prints a guide and bumps versions in manifests. It lists manual steps, points at up to 20 legacy import sites, and cites a Raven doc only when its title or url is a migration document. It does not rewrite source code and never runs cargo or npm.</> },
    versions: { term: "Versions only", detail: <>It measures SDK version drift. It does not audit contract logic, security or runtime behavior.</> },
    scan: { term: "Scan limits", detail: <>Four folders deep, with common build and dependency folders skipped. See <L to="/docs/what-it-scans">What it scans</L>.</> },
    platforms: { term: "Platforms", detail: <>Developed and checked on macOS. The browser-opening code has a Windows branch, but Windows has not been verified.</> },
  },
} satisfies DocsLimitationsDict;
