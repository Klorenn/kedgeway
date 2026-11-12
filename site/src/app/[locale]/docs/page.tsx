import Link from "next/link";
import PrevNext from "@/components/docs/PrevNext";
import { DOCS_FLAT } from "@/data/docs-nav";
import { byLocale } from "@/i18n/config";
import { href } from "@/i18n/href";
import { localeOf, metaFor } from "@/i18n/server";
import { UI } from "@/content/ui";
import en from "@/content/en/docs/overview";
import es from "@/content/es/docs/overview";
import styles from "./docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs">) => metaFor(params, "/docs", DICT);

export default async function Overview({ params }: PageProps<"/[locale]/docs">) {
  const locale = await localeOf(params);
  const t = byLocale(locale, DICT);
  const pages = UI[locale].docs.pages;
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.isH}</h2>
      <ul>
        <li>{t.is.cli}</li>
        <li>{t.is.grounded}</li>
        <li>{t.is.evidence}</li>
        <li>{t.is.honest}</li>
      </ul>

      <h2>{t.isNotH}</h2>
      <ul>
        <li>{t.isNot.rewriter}</li>
        <li>{t.isNot.lockfile}</li>
        <li>{t.isNot.audit}</li>
        <li>{t.isNot.service}</li>
      </ul>

      <h2>{t.thinksH}</h2>
      <ol>
        <li>{t.thinks.scan}</li>
        <li>{t.thinks.ask}</li>
        <li>{t.thinks.diagnose}</li>
      </ol>

      <h2>{t.nextH}</h2>
      <dl className={styles.defs}>
        {DOCS_FLAT.filter((p) => p.href !== "/docs").map((p) => (
          <div key={p.href}>
            <dt><Link href={href(locale, p.href)}>{pages[p.id].title}</Link></dt>
            <dd>{pages[p.id].summary}</dd>
          </div>
        ))}
      </dl>
      <PrevNext href="/docs" />
    </>
  );
}
