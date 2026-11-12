"use client";

import { useFrameSprite } from "@/lib/frame-sprite";
import { useLocale } from "@/i18n/LocaleProvider";
import { fill } from "@/content/schema/ui";
import styles from "./PlateIndex.module.css";

const FRAME_VIEWBOX = "0 0 180 101";
const NUMBERS = Array.from({ length: 11 }, (_, i) => i + 1);

/** Plate/Index: contact sheet of the 11 frames (static), baseline rule, frame ruler 01-11, caption and credit. */
export default function PlateIndex({ frame }: { frame: number }) {
  const ready = useFrameSprite();
  const { ui } = useLocale();
  return (
    <div className={styles.plate}>
      <div className={styles.sheet} aria-hidden="true">
        {NUMBERS.map((n) => (
          <div key={n} className={styles.cell}>
            <svg className={styles.thumb} viewBox={FRAME_VIEWBOX} fill="none" focusable="false">
              {ready ? <use href={`#kw-frame-${String(n).padStart(2, "0")}`} width="180" height="101" /> : null}
            </svg>
          </div>
        ))}
      </div>
      <div className={styles.baseline} aria-hidden="true" />
      <div className={styles.ruler} aria-hidden="true">
        {NUMBERS.map((n) => (
          <div key={n} className={styles.mark} data-active={n === frame}>
            <span className={styles.tick} />
            <span className="t-mono-label">{String(n).padStart(2, "0")}</span>
          </div>
        ))}
      </div>
      <div className={`t-mono-label ${styles.caption}`}>
        <p className={styles.fig}>{fill(ui.plateCaption, { frame: String(frame).padStart(2, "0") })}</p>
        <p>{ui.plateCredit}</p>
      </div>
    </div>
  );
}
