import type { DocsFaqDict } from "../../schema/docs-faq";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Preguntas frecuentes — documentación de kedgeway", description: "Respuestas cortas a las preguntas comunes sobre kedgeway." },
  h1: "Preguntas frecuentes",
  items: {
    privacy: { q: "¿kedgeway envía mi código a algún lado?", a: "No. Envía un único script fijo a Stellar Raven, sin nada de tu repo. La comparación se hace en tu máquina." },
    login: { q: "¿Por qué tengo que iniciar sesión?", a: "Los datos del ecosistema en vivo vienen del servidor MCP Stellar Raven, que requiere OAuth. Inicias sesión una vez; el token se guarda en ~/.config/kedgeway/auth.json." },
    changes: { q: "¿Modifica mi repo?", a: "diagnose nunca lo hace. kedgeway migrate es un dry run salvo que pases --write, y se niega a escribir sobre cambios de git sin commit." },
    headless: { q: "¿Puedo iniciar sesión en un servidor sin navegador?", a: <>Sí. <code>kedgeway login --no-browser</code> imprime la URL; inicia sesión desde cualquier lugar y pega la URL de redirección o el código, o reenvía el puerto de callback con <code>ssh -L</code>. Consulta <L to="/docs/authentication#headless">Autenticación</L>.</> },
    offline: { q: "¿Puedo ejecutarlo sin conexión?", a: <>Sí. <code>--offline</code> reutiliza el snapshot de Raven en caché de tu última ejecución en vivo, y <code>--fixture</code> usa un archivo de snapshot. Consulta <L to="/docs/data-sources">Fuentes de datos</L> y <L to="/docs/fixtures">Fixtures</L>.</> },
    unknown: { q: "¿Por qué obtengo SDK_UNKNOWN?", a: <>O la versión de tu manifiesto no se puede leer como un único major (por ejemplo, un límite superior o un rango compuesto), o el major actual no estaba disponible. Consulta <L to="/docs/what-it-scans">Qué escanea</L> y <L to="/docs/findings#data_degraded">DATA_DEGRADED</L>.</> },
    lockfile: { q: "¿Lee mi lockfile?", a: <>Sí, cuando existe. <code>Cargo.lock</code>, <code>package-lock.json</code>, <code>pnpm-lock.yaml</code> y <code>yarn.lock</code> aportan la versión resuelta de cada dependencia directa, y esa es la versión que usa la comparación. Si el lockfile falta o es ambiguo, kedgeway recurre al manifiesto y lo indica. Consulta <L to="/docs/what-it-scans">Qué escanea</L>.</> },
    failOn: { q: "¿Qué --fail-on debo usar en CI?", a: <><code>critical</code> falla con SDK obsoletos y paquetes heredados. <code>warning</code> también falla con un major de desfase y con versiones desconocidas. Consulta <L to="/docs/ci">CI</L>.</> },
    npm: { q: "¿Está en npm?", a: "Sí. npm install -g kedgeway. Necesita Node 22.12 o más reciente." },
  },
} satisfies DocsFaqDict;
