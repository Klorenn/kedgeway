import CopyButton from "./CopyButton";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  /** The text shown and copied. One command per line; no `$` prompts. */
  code: string;
  /** Language or kind shown in the top bar. */
  label?: string;
  /** Output blocks are not copyable. */
  copy?: boolean;
}

/** Code block with a label bar and a copy button. The block is server-rendered; only the button is client code. */
export default function CodeBlock({ code, label = "bash", copy = true }: CodeBlockProps) {
  return (
    <div className={styles.block}>
      <div className={styles.bar}>
        <span>{label}</span>
        {copy ? <CopyButton text={code} /> : null}
      </div>
      <pre className={styles.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
