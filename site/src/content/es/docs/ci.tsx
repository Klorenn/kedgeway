import type { DocsCiDict } from "../../schema/docs-ci";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "CI — documentación de kedgeway", description: "Haz fallar un build por desfase del SDK con --fail-on y ejecuta sin conexión en CI con un fixture." },
  h1: "CI",
  lede: <>Usa <code>--fail-on</code> para convertir los hallazgos en un código de salida de error.</>,
  exitH: "Códigos de salida",
  exit: {
    ok: <><code>0</code>: terminó, no hay nada en el umbral ni por encima.</>,
    error: <><code>1</code>: error de la herramienta. Trátalo como una falla de infraestructura.</>,
    drift: <><code>2</code>: un hallazgo alcanzó el umbral. Esta es la señal de desfase.</>,
  },
  threshold: <>Elige el umbral según qué tan estricto quieras ser: <code>--fail-on critical</code> falla con SDK obsoletos y paquetes heredados; <code>--fail-on warning</code> también falla cuando hay un major de atraso y con los desconocidos.</>,
  liveH: "Datos en vivo en CI",
  liveP: <>Exporta tu inicio de sesión de Raven guardado una sola vez, en una máquina donde hayas iniciado sesión, y guárdalo como secreto del repositorio:</>,
  secretP: <>Crea un secreto llamado <code>KEDGEWAY_AUTH</code> con ese valor (Settings, Secrets and variables, Actions). En la <L to="/docs/github-action">GitHub Action</L> pásalo como <code>auth: ${"{{ secrets.KEDGEWAY_AUTH }}"}</code>. Fuera de la action, define tú mismo la variable de entorno <code>KEDGEWAY_AUTH</code>.</>,
  warning: <>El secreto contiene tokens de OAuth: trátalo como una contraseña. kedgeway renueva el token solo en memoria y nunca lo escribe en disco. Si Raven rota los refresh tokens, el secreto guardado puede quedar vencido. Vuelve a exportarlo cuando las ejecuciones empiecen a fallar.</>,
  noSecret: <>¿Prefieres no usar ningún secreto? Ejecuta sin conexión contra un snapshot guardado con <code>--fixture</code> y actualízalo a mano. Consulta <L to="/docs/fixtures">Fixtures</L>. La action necesita una de las dos: <code>auth</code> o <code>fixture</code>.</>,
  exampleH: "Ejemplo con GitHub Actions",
  exampleP: <>Instala la CLI publicada y revisa el repo contra un fixture incluido en un commit. Para la action mantenida, consulta <L to="/docs/github-action">GitHub Action</L>.</>,
  exampleAfter: <>El paso diagnose sale con 2 cuando existe un hallazgo warning o critical, y con 1 ante un error de la herramienta. Haz commit de <code>snapshot.json</code> junto al workflow, o quita <code>--fixture</code> y define <code>KEDGEWAY_AUTH</code> en el entorno del paso para usar datos en vivo.</>,
} satisfies DocsCiDict;
