import type { DocsGettingStartedDict } from "../../schema/docs-getting-started";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Primeros pasos — documentación de kedgeway", description: "Instala kedgeway desde npm, inicia sesión y ejecuta tu primer diagnóstico." },
  h1: "Primeros pasos",
  lede: <>Cinco minutos desde la instalación hasta tu primer reporte. Necesitas Node.js 22.12 o una versión más reciente.</>,
  installH: "Instalar",
  installP: <>Instala la CLI. Necesita Node.js 22.12 o una versión más reciente.</>,
  hack: <>Para modificarla, clona <a href="https://github.com/Klorenn/kedgeway">Klorenn/kedgeway</a> y luego ejecuta <code>npm ci</code>, <code>npm run build</code> y <code>npm link</code>.</>,
  check: <>Comprueba que funcionó:</>,
  loginH: "Iniciar sesión",
  loginP: <>Esto abre tu navegador para autorizar a kedgeway con Stellar Raven. La URL de autorización también se imprime en la terminal, por si el navegador no se abre. Solo lo haces una vez; el token se guarda localmente. Los detalles están en <L to="/docs/authentication">Autenticación</L>.</>,
  runH: "Ejecuta tu primer diagnóstico",
  runP: <>La ruta es opcional y, por defecto, es el directorio actual. kedgeway recorre el repo, obtiene datos del ecosistema en vivo e imprime un reporte.</>,
  readH: "Lee la salida",
  defs: {
    header: { dt: "Encabezado", dd: <>La raíz que se escaneó y el major actual de soroban-sdk con la hora en que se observó.</> },
    finding: { dt: "Cada hallazgo", dd: <>Severidad, código y archivo en la primera línea; luego qué significa; luego la evidencia y su fuente.</> },
    summary: { dt: "Resumen", dd: <>Conteos por severidad.</> },
  },
  codes: <>Cada código se explica en <L to="/docs/findings">Hallazgos</L>. En el ejemplo, <code>&lt;source&gt;</code> y <code>&lt;time&gt;</code> reemplazan la cadena real de la fuente y la marca de tiempo.</>,
  note: <>Usa <code>--json</code> para obtener una salida legible por máquinas y <code>--fail-on</code> para convertir los hallazgos en un código de salida. Consulta <L to="/docs/commands">Comandos</L>.</>,
} satisfies DocsGettingStartedDict;
