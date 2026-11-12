import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("Fixtures — kedgeway docs", "The ecosystem snapshot JSON format used by --fixture, with a complete example.", "/docs/fixtures");

const EXAMPLE = `{
  "observedAt": "2026-11-11T22:00:57Z",
  "sorobanSdk": {
    "currentMajor": 28,
    "deprecatedVersions": ["21.0.0", "20.5.0"],
    "source": "snapshot saved from Software Versions page"
  },
  "jsSdk": {
    "currentVersion": "<current @stellar/stellar-sdk version>",
    "source": "snapshot saved from Software Versions page"
  },
  "protocolCurrent": null,
  "notes": [
    { "title": "Upgrade notes", "url": "https://example.com/notes", "snippet": "Short excerpt." }
  ],
  "degraded": []
}`;

export default function Fixtures() {
  return (
    <>
      <h1>Fixtures</h1>
      <p className={styles.lede}>A fixture is a saved ecosystem snapshot. Pass it with <code>--fixture</code> to run without Raven: for tests, offline machines and CI.</p>

      <CodeBlock code={"kedgeway diagnose ./my-contract --fixture snapshot.json"} />

      <h2>Shape</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Field</th><th scope="col">Type</th><th scope="col">Notes</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>observedAt</code></th><td>string</td><td>Required. When the snapshot was taken, ISO 8601.</td></tr>
            <tr><th scope="row"><code>sorobanSdk.currentMajor</code></th><td>integer or null</td><td>Required. Null makes soroban-sdk findings SDK_UNKNOWN.</td></tr>
            <tr><th scope="row"><code>sorobanSdk.deprecatedVersions</code></th><td>string[]</td><td>Required. Versions listed as deprecated. Only their majors are compared.</td></tr>
            <tr><th scope="row"><code>sorobanSdk.source</code></th><td>string</td><td>Required. Shown as the source in findings.</td></tr>
            <tr><th scope="row"><code>jsSdk.currentVersion</code></th><td>string or null</td><td>Required. Null makes JavaScript findings JS_SDK_UNKNOWN.</td></tr>
            <tr><th scope="row"><code>jsSdk.source</code></th><td>string</td><td>Required.</td></tr>
            <tr><th scope="row"><code>protocolCurrent</code></th><td>number or null</td><td>Optional. Defaults to null.</td></tr>
            <tr><th scope="row"><code>notes</code></th><td>array</td><td>Required, may be empty. Items have <code>title</code>, <code>url</code> and <code>snippet</code> (all strings).</td></tr>
            <tr><th scope="row"><code>degraded</code></th><td>string[]</td><td>Optional. Defaults to empty. Each entry becomes a DATA_DEGRADED finding.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Complete example</h2>
      <CodeBlock code={EXAMPLE} />
      <p>A file that does not match this shape makes the run exit with 1 and a message. Fixtures are not refreshed automatically: the ecosystem moves, your fixture does not.</p>
      <PrevNext href="/docs/fixtures" />
    </>
  );
}
