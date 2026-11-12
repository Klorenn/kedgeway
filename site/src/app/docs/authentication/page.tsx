import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("Authentication — kedgeway docs", "How kedgeway signs in to Stellar Raven, what it stores, and what it sends.", "/docs/authentication");

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
        <code>kedgeway login</code> starts a fresh authorization: it clears the stored token, client registration and verifier first. <code>login --export</code> does not clear them. It prints what is already stored, and only starts a login when nothing is stored. <code>kedgeway diagnose</code> first tries your stored token silently, with no server and no browser. Only if Raven answers 401 does it start the interactive flow.
      </p>

      <h2>Where the token lives</h2>
      <Callout kind="warning">
        <p>Anyone who can read <code>~/.config/kedgeway/auth.json</code> can use your Raven session. kedgeway writes it with mode 0600; keep it out of backups and repos, and run <code>kedgeway logout</code> on shared machines.</p>
      </Callout>
      <CodeBlock code={"~/.config/kedgeway/auth.json"} />
      <p>The folder is created with mode 0700 and the file is written with mode 0600, through a temporary file and a rename. It holds the OAuth tokens, the client registration, and the last callback port.</p>
      <p>To delete it:</p>
      <CodeBlock code={"kedgeway logout"} />

      <h2>What is sent to Raven</h2>
      <p>
        Only one fixed script, run through Raven&apos;s <code>execute</code> tool. It asks for the Software Versions page, the Scout toolchain index and a documentation search. It does not include anything from your repo. File names, manifests and versions stay on your machine; the comparison happens locally.
      </p>

      <h2 id="headless">Headless login</h2>
      <p>
        Raven&apos;s OAuth server offers authorization code with PKCE and refresh tokens only, with no device-code grant, so there is no <code>--device</code> flow. On a machine without a browser, use:
      </p>
      <CodeBlock code={"kedgeway login --no-browser"} />
      <p>
        kedgeway prints the authorization URL and does not try to open a browser. Open it in any browser and sign in. The browser is then redirected to <code>http://127.0.0.1:&lt;port&gt;/callback</code>, which only exists on the machine running kedgeway. Two ways to finish:
      </p>
      <ul>
        <li><strong>Paste it back.</strong> Copy the full redirect URL (or just its <code>code</code>) into the terminal and press Enter. Bad input gets a one-line error and the prompt repeats.</li>
        <li><strong>Forward the port.</strong> From your own machine, before you sign in, forward the callback port so the redirect lands on kedgeway directly. The port is in the <code>redirect_uri</code> of the printed URL.</li>
      </ul>
      <CodeBlock code={"ssh -L <port>:127.0.0.1:<port> user@remote-host"} />
      <p>
        A pasted URL is checked against the login attempt&apos;s OAuth state, and the check fails closed: with no state to compare, a pasted URL is refused. A bare code carries no state, so it cannot be checked. When stdin is not a terminal, pasting is disabled and only the callback can finish the login.
      </p>
      <p>
        For CI, do this once on a trusted machine and add <code>--export</code> to print the secret afterwards:
      </p>
      <CodeBlock code={"kedgeway login --no-browser --export"} />

      <h2>In CI</h2>
      <p>Run <code>kedgeway login --export</code> to print your stored credentials as a base64 secret, and put it in a <code>KEDGEWAY_AUTH</code> secret. At runtime the variable replaces <code>auth.json</code>: it is never written to disk and refreshes in memory only, so a rotated refresh token can make it go stale. See <Link href="/docs/ci">CI</Link>.</p>

      <h2>Troubleshooting</h2>
      <dl className={styles.defs}>
        <dt>The port is busy</dt>
        <dd>kedgeway falls back to a different free port on 127.0.0.1. Nothing to do.</dd>
        <dt>The browser did not open</dt>
        <dd>Copy the URL printed in the terminal (stderr) into a browser on the same machine. On a server with no browser, see <a href="#headless">Headless login</a>.</dd>
        <dt>Login timed out</dt>
        <dd>The callback gives up after 5 minutes. Run <code>kedgeway login</code> again.</dd>
        <dt>The token was rejected</dt>
        <dd>kedgeway reports that authentication succeeded but Raven rejected the token. Run <code>kedgeway logout</code>, then <code>kedgeway login</code>.</dd>
      </dl>
      <PrevNext href="/docs/authentication" />
    </>
  );
}
