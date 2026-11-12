import DocsNav from "@/components/docs/DocsNav";
import DocsToc from "@/components/docs/DocsToc";
import styles from "./docs.module.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`wrap ${styles.docs}`}>
      <DocsNav />
      <article className={styles.prose}>{children}</article>
      <DocsToc />
    </div>
  );
}
