import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { AuthStep, AuthTrouble } from "@/content/schema/docs-authentication";
import en from "@/content/en/docs/authentication";
import es from "@/content/es/docs/authentication";
import styles from "../docs.module.css";

const DICT = { en, es };
const STEPS: readonly AuthStep[] = ["registration", "pkce", "callback", "browser", "token"];
const TROUBLE: readonly AuthTrouble[] = ["port", "browser", "timeout", "rejected"];

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/authentication">) => metaFor(params, "/docs/authentication", DICT);

export default async function Authentication({ params }: PageProps<"/[locale]/docs/authentication">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.howH}</h2>
      <ol>
        {STEPS.map((k) => <li key={k}>{t.how[k]}</li>)}
      </ol>
      <p>{t.wait}</p>

      <h2>{t.whenH}</h2>
      <p>{t.whenP}</p>

      <h2>{t.whereH}</h2>
      <Callout kind="warning">
        <p>{t.warning}</p>
      </Callout>
      <CodeBlock code={"~/.config/kedgeway/auth.json   # or $KEDGEWAY_CONFIG_DIR/auth.json, else $XDG_CONFIG_HOME/kedgeway/auth.json"} />
      <p>{t.whereP}</p>
      <p>{t.deleteP}</p>
      <CodeBlock code={"kedgeway logout"} />

      <h2>{t.sentH}</h2>
      <p>{t.sentP}</p>

      <h2 id="headless">{t.headlessH}</h2>
      <p>{t.headlessP}</p>
      <CodeBlock code={"kedgeway login --no-browser"} />
      <p>{t.headlessAfter}</p>
      <ul>
        <li>{t.finish.paste}</li>
        <li>{t.finish.forward}</li>
      </ul>
      <CodeBlock code={"ssh -L <port>:127.0.0.1:<port> user@remote-host"} />
      <p>{t.checked}</p>
      <p>{t.forCi}</p>
      <CodeBlock code={"kedgeway login --no-browser --export"} />

      <h2>{t.ciH}</h2>
      <p>{t.ciP}</p>

      <h2>{t.troubleH}</h2>
      <dl className={styles.defs}>
        {TROUBLE.map((k) => [
          <dt key={`${k}-t`}>{t.trouble[k].dt}</dt>,
          <dd key={`${k}-d`}>{t.trouble[k].dd}</dd>,
        ])}
      </dl>
      <PrevNext href="/docs/authentication" />
    </>
  );
}
