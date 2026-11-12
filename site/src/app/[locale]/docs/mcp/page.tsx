import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { McpTool } from "@/content/schema/docs-mcp";
import en from "@/content/en/docs/mcp";
import es from "@/content/es/docs/mcp";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/mcp">) => metaFor(params, "/docs/mcp", DICT);

/** Tool name → its input signature (code; null when the tool takes no input). */
const TOOLS: readonly (readonly [McpTool, string | null])[] = [
  ["diagnose", "{ path | url, ref?, fixture?, failOn?, format? }"],
  ["findings_reference", null],
  ["migrate", "{ path | url, ref?, fixture?, write? }"],
  ["ecosystem_snapshot", "{ fixture? }"],
];

export default async function Page({ params }: PageProps<"/[locale]/docs/mcp">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.toolsH}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.cols.tool}</th><th scope="col">{t.cols.input}</th><th scope="col">{t.cols.returns}</th></tr></thead>
          <tbody>
            {TOOLS.map(([tool, input]) => (
              <tr key={tool}><th scope="row"><code>{tool}</code></th><td>{input ? <code>{input}</code> : t.none}</td><td>{t.returns[tool]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t.remoteH}</h2>
      <p>{t.remote}</p>
      <p>{t.remoteDry}</p>

      <h2>{t.configH}</h2>
      <p>{t.config}</p>
      <CodeBlock code={`{
  "mcpServers": {
    "kedgeway": { "command": "kedgeway", "args": ["mcp"] }
  }
}`} />

      <h2>{t.loginH}</h2>
      <Callout kind="warning">
        <p>{t.loginWarning}</p>
      </Callout>
      <p>{t.loginBody}</p>
      <PrevNext href="/docs/mcp" />
    </>
  );
}
