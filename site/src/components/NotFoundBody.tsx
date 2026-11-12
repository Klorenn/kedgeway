"use client";

import Link from "next/link";
import Gallop from "@/components/Gallop";
import { href } from "@/i18n/href";
import { useLocale } from "@/i18n/LocaleProvider";
import styles from "./NotFoundBody.module.css";

/** 404 in the active locale. `withTitle` renders the localized <title> (React hoists it into <head>). */
export default function NotFoundBody({ withTitle = true }: { withTitle?: boolean }) {
  const { locale, ui } = useLocale();
  const t = ui.notFound;
  return (
    <div className={styles.wrap}>
      {withTitle ? <title>{t.title}</title> : null}
      <div className={styles.col}>
        <Gallop size={240} startFrame={5} animate={false} />
        <h1>
          {t.lead} <em>{t.em}</em>
        </h1>
        <p className={styles.mono}>{t.status}</p>
        <Link className={styles.back} href={href(locale, "/")}>
          {t.back}
        </Link>
      </div>
    </div>
  );
}
