import ground from "@/generated/textureGround.generated";
import styles from "./DesignFigure.module.css";

/** Texture/Ground: a bare inline SVG (desktop and mobile exports, switched by CSS at 768). Small enough to ship in the HTML.
 *  Captioned figures (fig. 2 to 8) use LazyDesignFigure instead. */
export default function DesignFigure({ className }: { name?: "textureGround"; className?: string }) {
  return (
    <div className={`${styles.bare}${className ? ` ${className}` : ""}`}>
      <svg
        className={styles.desktop}
        viewBox={`0 0 ${ground.desktop.w} ${ground.desktop.h}`}
        style={{ maxWidth: ground.desktop.w, aspectRatio: `${ground.desktop.w} / ${ground.desktop.h}` }}
        fill="none"
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: ground.desktop.inner }}
      />
      <svg
        className={styles.mobile}
        viewBox={`0 0 ${ground.mobile.w} ${ground.mobile.h}`}
        style={{ maxWidth: ground.mobile.w, aspectRatio: `${ground.mobile.w} / ${ground.mobile.h}` }}
        fill="none"
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: ground.mobile.inner }}
      />
    </div>
  );
}
