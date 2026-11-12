import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import en from "@/content/en/docs/ci";
import es from "@/content/es/docs/ci";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/ci">) => metaFor(params, "/docs/ci", DICT);

export default async function Ci({ params }: PageProps<"/[locale]/docs/ci">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.exitH}</h2>
      <ul>
        <li>{t.exit.ok}</li>
        <li>{t.exit.error}</li>
        <li>{t.exit.drift}</li>
      </ul>
      <p>{t.threshold}</p>

      <h2>{t.liveH}</h2>
      <p>{t.liveP}</p>
      <CodeBlock code={`kedgeway login --export | pbcopy   # macOS; use xclip or wl-copy elsewhere`} />
      <p>{t.secretP}</p>
      <Callout kind="warning">
        <p>{t.warning}</p>
      </Callout>
      <p>{t.noSecret}</p>

      <h2>{t.exampleH}</h2>
      <p>{t.exampleP}</p>
      <CodeBlock label="yaml" code={`name: kedgeway
on: [push, pull_request]
jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install -g kedgeway
      - run: kedgeway diagnose . --fail-on warning --fixture snapshot.json`} />
      <p>{t.exampleAfter}</p>
      <PrevNext href="/docs/ci" />
    </>
  );
}
