"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import styles from "./FooterBand.module.css";

// Below the fold: neither chunk loads until the band is near the viewport.
const FooterLandscape = dynamic(() => import("./FooterLandscape"), { ssr: false });
const Gallop = dynamic(() => import("./Gallop"), { ssr: false });

/** Landscape band: 342px desktop / 240px mobile (reserved, so no layout shift), with the small gallop (Frame 05, 200 / 120px). */
export default function FooterBand() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={styles.band} aria-hidden="true">
      {near ? (
        <>
          <FooterLandscape />
          <div className={styles.gallop}>
            <Gallop startFrame={5} />
          </div>
        </>
      ) : null}
    </div>
  );
}
