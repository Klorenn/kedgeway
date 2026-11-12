import CopyButton from "./CopyButton";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  /** The text shown and copied. One command per line; no `$` prompts. Comment lines start with `#`. */
  code: string;
  /** Output blocks are not copyable. */
  copy?: boolean;
  /** Accepted for older call sites; the block no longer shows a label bar. */
  label?: string;
}

/** Code block with a top-right copy button. The block is server-rendered; only the button is client code. */
export default function CodeBlock({ code, copy = true }: CodeBlockProps) {
  return (
    <div className={styles.block}>
      {copy ? <CopyButton text={code} /> : null}
      <pre className={styles.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
