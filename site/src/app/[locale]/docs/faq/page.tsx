import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { FaqId } from "@/content/schema/docs-faq";
import en from "@/content/en/docs/faq";
import es from "@/content/es/docs/faq";
import styles from "../docs.module.css";

const DICT = { en, es };
const ORDER: readonly FaqId[] = ["privacy", "login", "changes", "headless", "offline", "unknown", "lockfile", "failOn", "npm"];

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/faq">) => metaFor(params, "/docs/faq", DICT);

export default async function Faq({ params }: PageProps<"/[locale]/docs/faq">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <dl className={styles.defs}>
        {ORDER.map((id) => (
          <div key={id}>
            <dt>{t.items[id].q}</dt>
            <dd>{t.items[id].a}</dd>
          </div>
        ))}
      </dl>
      <PrevNext href="/docs/faq" />
    </>
  );
}
