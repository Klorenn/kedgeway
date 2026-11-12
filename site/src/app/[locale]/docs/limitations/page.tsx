import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { LimitationId } from "@/content/schema/docs-limitations";
import en from "@/content/en/docs/limitations";
import es from "@/content/es/docs/limitations";
import styles from "../docs.module.css";

const DICT = { en, es };
const ORDER: readonly LimitationId[] = ["lockfile", "annotations", "deviceCode", "sample", "docsPage", "raven", "migration", "versions", "scan", "platforms"];

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/limitations">) => metaFor(params, "/docs/limitations", DICT);

export default async function Limitations({ params }: PageProps<"/[locale]/docs/limitations">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>
      <Callout kind="note">
        <p>{t.note}</p>
      </Callout>
      <dl className={styles.defs}>
        {ORDER.map((id) => [<dt key={`${id}-t`}>{t.items[id].term}</dt>, <dd key={`${id}-d`}>{t.items[id].detail}</dd>])}
      </dl>
      <PrevNext href="/docs/limitations" />
    </>
  );
}
