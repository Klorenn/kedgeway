import type { Metadata } from "next";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Roadmap — kedgeway docs",
  description: "Planned kedgeway work. None of it has shipped.",
  alternates: { canonical: "/docs/roadmap" },
  openGraph: { title: "Roadmap — kedgeway docs", description: "Planned kedgeway work. None of it has shipped.", url: "/docs/roadmap" },
};

export default function Roadmap() {
  return (
    <>
      <h1>Roadmap</h1>
      <p className={styles.lede}>Everything on this page is planned. None of it has shipped.</p>
      <dl className={styles.defs}>
        <dt>MCP server <span className={styles.sev}>not shipped</span></dt>
        <dd>Expose <code>diagnose</code> so coding agents can call it directly.</dd>
        <dt>TypeScript SDK <span className={styles.sev}>not shipped</span></dt>
        <dd>Run diagnoses from your own tooling.</dd>
        <dt>Migration mode <span className={styles.sev}>not shipped</span></dt>
        <dd>Open a PR with the upgrade already applied.</dd>
        <dt>GitHub Action <span className={styles.sev}>not shipped</span></dt>
        <dd>Check every pull request for drift, including live data in CI.</dd>
      </dl>
      <PrevNext href="/docs/roadmap" />
    </>
  );
}
