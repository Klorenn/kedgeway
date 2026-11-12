import type { Metadata } from "next";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Limitations — kedgeway docs",
  description: "What kedgeway does not do, so you can judge its output.",
  alternates: { canonical: "/docs/limitations" },
  openGraph: { title: "Limitations — kedgeway docs", description: "What kedgeway does not do, so you can judge its output.", url: "/docs/limitations", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function Limitations() {
  return (
    <>
      <h1>Limitations</h1>
      <p className={styles.lede}>kedgeway says what it does not know. These are the gaps to keep in mind.</p>
      <Callout kind="note">
        <p>A clean report is evidence about declared versions only. It is not a security review of your contracts.</p>
      </Callout>
      <dl className={styles.defs}>
        <dt>Lockfile parsing is limited</dt>
        <dd>Cargo.lock, package-lock.json, pnpm-lock.yaml and yarn.lock are read; pnpm and yarn with a minimal parser, so unusual layouts fall back to the manifest version. Nothing above the scan root is read.</dd>
        <dt>The deprecated list is a sample</dt>
        <dd>Scout&apos;s deprecated sample is capped at 50. A version missing from it is not proof that it is supported. kedgeway also treats anything more than one major behind as deprecated.</dd>
        <dt>Current versions come from a docs page</dt>
        <dd>They are read from the official Software Versions page. If that page changes shape, parsing can fail, and the report says so with DATA_DEGRADED.</dd>
        <dt>Raven must be reachable</dt>
        <dd>A live run needs network access and a valid Raven sign-in. Offline, use <code>--offline</code> (the cached snapshot) or <code>--fixture</code>. For CI, export the login into a <code>KEDGEWAY_AUTH</code> secret; it can go stale if Raven rotates refresh tokens.</dd>
        <dt>Migration is narrow</dt>
        <dd><code>kedgeway migrate</code> prints a guide and bumps versions in manifests. It lists manual steps, points at up to 20 legacy import sites, and cites a Raven doc only when its title or url is a migration document. It does not rewrite source code and never runs cargo or npm.</dd>
        <dt>Versions only</dt>
        <dd>It measures SDK version drift. It does not audit contract logic, security or runtime behavior.</dd>
        <dt>Scan limits</dt>
        <dd>Four folders deep, with common build and dependency folders skipped. See What it scans.</dd>
        <dt>Platforms</dt>
        <dd>Developed and checked on macOS. The browser-opening code has a Windows branch, but Windows has not been verified.</dd>
        <dt>Not on npm yet</dt>
        <dd>Install from source for now.</dd>
      </dl>
      <PrevNext href="/docs/limitations" />
    </>
  );
}
