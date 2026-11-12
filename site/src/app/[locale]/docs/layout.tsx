import DocsBreadcrumb from "@/components/docs/DocsBreadcrumb";
import DocsNav from "@/components/docs/DocsNav";
import DocsToc from "@/components/docs/DocsToc";
import styles from "./docs.module.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`container ${styles.docs}`}>
      <DocsNav />
      <article className={styles.prose}>
        <DocsBreadcrumb className={`t-mono-label ${styles.crumb}`} />
        {children}
      </article>
      <DocsToc />
    </div>
  );
}
