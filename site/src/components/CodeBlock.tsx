import CopyButton from "./CopyButton";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  /** The text shown and copied. One command per line; no `$` prompts. Comment lines start with `#`. */
  code: string;
  /** Output blocks are not copyable. */
  copy?: boolean;
  /** Header label: "Terminal" for commands, "Clone" for the clone block. Defaults to "Terminal", or "Output" when not copyable. */
  label?: string;
}

/** Surface panel with a header (label + Copy) over the code. Server-rendered; only the button is client code. */
export default function CodeBlock({ code, copy = true, label }: CodeBlockProps) {
  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className="t-mono-label">{label ?? (copy ? "Terminal" : "Output")}</span>
        {copy ? <CopyButton text={code} /> : null}
      </div>
      <pre className={`${styles.pre} t-command`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
