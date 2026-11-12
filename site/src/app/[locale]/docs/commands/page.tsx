import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { DiagnoseFlag, DoctorCheck } from "@/content/schema/docs-commands";
import en from "@/content/en/docs/commands";
import es from "@/content/es/docs/commands";
import styles from "../docs.module.css";

const DICT = { en, es };

// Flag syntax stays as the CLI prints it; descriptions come from the dictionary.
const DIAGNOSE_FLAGS: readonly (readonly [DiagnoseFlag, string])[] = [
  ["ref", "--ref <ref>"],
  ["json", "--json"],
  ["format", "--format <text|json|sarif|annotations>"],
  ["sarif", "--sarif <file>"],
  ["annotations", "--annotations <file>"],
  ["offline", "--offline"],
  ["noCache", "--no-cache"],
  ["maxAge", "--max-age <duration>"],
  ["fixture", "--fixture <file>"],
  ["failOn", "--fail-on <severity>"],
];
const DOCTOR_CHECKS: readonly DoctorCheck[] = ["node", "auth", "cache", "stellar", "raven"];
const EXIT_CODES = ["0", "1", "2"] as const;

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/commands">) => metaFor(params, "/docs/commands", DICT);

export default async function Commands({ params }: PageProps<"/[locale]/docs/commands">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2 id="version">--version</h2>
      <CodeBlock code={"kedgeway --version\nkedgeway -V"} />
      <p>{t.versionP}</p>

      <h2 id="diagnose">diagnose</h2>
      <CodeBlock code={"kedgeway diagnose [path-or-url] [--ref <ref>] [--json] [--format <text|json|sarif|annotations>] [--sarif <file>] [--annotations <file>] [--fixture <file>] [--fail-on <severity>] [--offline] [--no-cache] [--max-age <duration>]"} />
      <p>{t.diagnoseP}</p>
      <dl className={styles.defs}>
        {DIAGNOSE_FLAGS.map(([k, flag]) => [
          <dt key={`${k}-t`}><code>{flag}</code></dt>,
          <dd key={`${k}-d`}>{t.diagnoseFlags[k]}</dd>,
        ])}
      </dl>
      <CodeBlock code={`kedgeway diagnose ./my-contract --fail-on critical
kedgeway diagnose . --json > report.json
kedgeway diagnose https://github.com/o/r
kedgeway diagnose o/r --ref v1.2.0 --fail-on warning`} />

      <h2 id="init">init</h2>
      <CodeBlock code={"kedgeway init [path] [--force] [--print]"} />
      <p>{t.initP}</p>
      <dl className={styles.defs}>
        <dt><code>--force</code></dt>
        <dd>{t.initFlags.force}</dd>
        <dt><code>--print</code></dt>
        <dd>{t.initFlags.print}</dd>
      </dl>
      <p>{t.initExit}</p>

      <h2 id="login">login</h2>
      <CodeBlock code={"kedgeway login"} />
      <p>{t.loginP}</p>

      <CodeBlock code={"kedgeway login --no-browser"} />
      <p>{t.loginNoBrowser}</p>

      <CodeBlock code={"kedgeway login --export"} />
      <p>{t.loginExport}</p>

      <h2 id="logout">logout</h2>
      <CodeBlock code={"kedgeway logout"} />
      <p>{t.logoutP}</p>

      <h2 id="doctor">doctor</h2>
      <CodeBlock code={"kedgeway doctor [--offline]"} />
      <p>{t.doctorP}</p>
      <ul>
        {DOCTOR_CHECKS.map((k) => <li key={k}>{t.doctorChecks[k]}</li>)}
      </ul>
      <p>{t.doctorExit}</p>

      <h2 id="migrate">migrate</h2>
      <CodeBlock code={"kedgeway migrate [path-or-url] [--ref <ref>] [--dry-run] [--write] [--fixture <file>] [--offline] [--no-cache] [--max-age <duration>]"} />
      <p>{t.migrateP}</p>
      <p>{t.migrateRemote}</p>
      <CodeBlock code={"kedgeway migrate https://gitlab.com/group/sub/r"} />

      <h2 id="mcp">mcp</h2>
      <CodeBlock code={"kedgeway mcp [--allow-write]"} />
      <p>{t.mcpP}</p>

      <h2 id="exit-codes">{t.exitH}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.exitHead.code}</th><th scope="col">{t.exitHead.meaning}</th></tr></thead>
          <tbody>
            {EXIT_CODES.map((c) => (
              <tr key={c}><th scope="row"><code>{c}</code></th><td>{t.exitRows[c]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{t.exitAfter}</p>
      <PrevNext href="/docs/commands" />
    </>
  );
}
