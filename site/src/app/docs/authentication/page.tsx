import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Authentication — kedgeway docs",
  description: "How kedgeway signs in to Stellar Raven, what it stores, and what it sends.",
  alternates: { canonical: "/docs/authentication" },
  openGraph: { title: "Authentication — kedgeway docs", description: "How kedgeway signs in to Stellar Raven, what it stores, and what it sends.", url: "/docs/authentication", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function Authentication() {
  return (
    <>
      <h1>Authentication</h1>
      <p className={styles.lede}>
        Live ecosystem data comes from the Stellar Raven MCP server, which requires OAuth. kedgeway signs you in once and stores the token on your machine.
      </p>

      <h2>How login works</h2>
      <ol>
        <li><strong>Dynamic client registration.</strong> kedgeway registers itself with Raven as a client named <code>kedgeway</code> with scope <code>mcp</code>. No client secret is baked into the tool.</li>
        <li><strong>PKCE.</strong> A code verifier is generated for the login and used to complete the code exchange.</li>
        <li><strong>Local callback.</strong> kedgeway starts a one-shot HTTP server on <code>127.0.0.1</code> to receive the redirect. It reuses the port from your last login when it can, otherwise the operating system picks one. The redirect carries a state value that must match, so stray requests are ignored.</li>
        <li><strong>Browser.</strong> The authorization URL is always printed to stderr. kedgeway also tries to open it with <code>open</code> (macOS), <code>xdg-open</code> (Linux) or <code>start</code> (Windows).</li>
        <li><strong>Token.</strong> The code is exchanged for a token and saved.</li>
      </ol>
      <p>The callback waits up to 5 minutes for you to authorize.</p>

      <h2>When it asks you to log in</h2>
      <p>
        <code>kedgeway login</code> always starts a fresh authorization: it clears the stored token, client registration and verifier first. <code>kedgeway diagnose</code> first tries your stored token silently, with no server and no browser. Only if Raven answers 401 does it start the interactive flow.
      </p>

      <h2>Where the token lives</h2>
      <Callout kind="warning">
        <p>Anyone who can read <code>~/.config/kedgeway/auth.json</code> can use your Raven session. kedgeway writes it with mode 0600; keep it out of backups and repos, and run <code>kedgeway logout</code> on shared machines.</p>
      </Callout>
      <CodeBlock label="bash" code={"~/.config/kedgeway/auth.json"} />
      <p>The folder is created with mode 0700 and the file is written with mode 0600, through a temporary file and a rename. It holds the OAuth tokens, the client registration, and the last callback port.</p>
      <p>To delete it:</p>
      <CodeBlock label="bash" code={"kedgeway logout"} />

      <h2>What is sent to Raven</h2>
      <p>
        Only one fixed script, run through Raven&apos;s <code>execute</code> tool. It asks for the Software Versions page, the Scout toolchain index and a documentation search. It does not include anything from your repo. File names, manifests and versions stay on your machine; the comparison happens locally.
      </p>

      <h2>Troubleshooting</h2>
      <dl className={styles.defs}>
        <dt>The port is busy</dt>
        <dd>kedgeway falls back to a different free port on 127.0.0.1. Nothing to do.</dd>
        <dt>The browser did not open</dt>
        <dd>Copy the URL printed in the terminal (stderr) into a browser on the same machine. The callback is local, so the browser must run where kedgeway runs.</dd>
        <dt>Login timed out</dt>
        <dd>The callback gives up after 5 minutes. Run <code>kedgeway login</code> again.</dd>
        <dt>The token was rejected</dt>
        <dd>kedgeway reports that authentication succeeded but Raven rejected the token. Run <code>kedgeway logout</code>, then <code>kedgeway login</code>.</dd>
      </dl>
      <PrevNext href="/docs/authentication" />
    </>
  );
}
