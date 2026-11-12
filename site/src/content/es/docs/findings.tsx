import type { DocsFindingsDict } from "../../schema/docs-findings";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");
const PIN = "La versión fijada y el archivo y la línea de donde sale, por ejemplo pinned in .github/workflows/ci.yml:23.";

export default {
  meta: { title: "Hallazgos — documentación de kedgeway", description: "Cada código de hallazgo de kedgeway: severidad, significado, evidencia y qué hacer." },
  h1: "Hallazgos",
  lede: <>Cada hallazgo tiene una severidad, un código, el archivo al que se aplica, un mensaje y la evidencia que lo respalda. Hay dieciocho códigos.</>,
  lockfile: <>Cuando un lockfile resuelve una dependencia, la evidencia lo indica, por ejemplo <code>resolved 21.7.6 from Cargo.lock; manifest ^21</code>, y la comparación usa la versión resuelta. Cuando el lockfile es ambiguo, se usa la versión del manifiesto y la evidencia lo anota. Consulta <L to="/docs/what-it-scans">Qué escanea</L>.</>,
  js: <>Las verificaciones de JavaScript comparan contra el release actual de <code>@stellar/stellar-sdk</code>. <code>@stellar/stellar-base</code> se compara con ese mismo release.</>,
  labels: { meaning: "Significado", evidence: "Evidencia que se muestra", todo: "Qué hacer" },
  findings: {
    SDK_DEPRECATED: {
      meaning: <>soroban-sdk está en un major que Scout lista como obsoleto y que es inferior al major actual, o está más de un major por detrás del major actual.</>,
      evidence: <>La comparación de majors: por ejemplo <code>{"major 21 < current major 28 and appears in the Scout deprecated sample"}</code>, o <code>{"major 21 < current major 28 - 1"}</code>, seguida de la fuente y la hora de observación.</>,
      todo: <>Actualiza soroban-sdk al major actual que aparece en el encabezado del reporte. Las notas de versión se obtienen de la búsqueda en la documentación (consulta Fuentes de datos).</>,
    },
    SDK_BEHIND: {
      meaning: <>soroban-sdk está exactamente un major por detrás del major actual.</>,
      evidence: <><code>{"major N = current major M - 1"}</code>, con la fuente y la hora de observación.</>,
      todo: <>Planifica la actualización al major actual. Todavía no es obsoleto.</>,
    },
    SDK_CURRENT: {
      meaning: <>soroban-sdk está en el major actual o en uno más reciente.</>,
      evidence: <><code>{"major N >= current major M"}</code>, con la fuente y la hora de observación.</>,
      todo: <>Nada. Si el major es más reciente que el del ecosistema, el mensaje dice <code>or newer</code>.</>,
    },
    SDK_UNKNOWN: {
      meaning: <>No se pudo interpretar la versión de soroban-sdk en el manifiesto, o el major actual no está disponible, así que no se hizo ninguna comparación.</>,
      evidence: <><code>Version unparseable from manifest; no comparison made</code> o <code>Current major evidence unavailable; no deprecation claim made</code>.</>,
      todo: <>Si la versión no se puede interpretar, declara una versión simple como <code>21.0.0</code> (consulta Qué escanea). Si el major actual no está disponible, busca un hallazgo DATA_DEGRADED y vuelve a ejecutar.</>,
    },
    JS_SDK_DEPRECATED: {
      meaning: <>Una dependencia del SDK de Stellar para JavaScript está más de un major por detrás del release actual.</>,
      evidence: <><code>{"major N < current major M - 1"}</code>, con la fuente y la hora de observación.</>,
      todo: <>Actualiza a la versión actual de @stellar/stellar-sdk. Revisa sus notas de versión por cambios incompatibles.</>,
    },
    JS_SDK_BEHIND: {
      meaning: <>Una dependencia del SDK de Stellar para JavaScript está exactamente un major por detrás del release actual.</>,
      evidence: <><code>{"major N = current major M - 1"}</code>, con la fuente y la hora de observación.</>,
      todo: <>Planifica la actualización al major actual.</>,
    },
    JS_SDK_CURRENT: {
      meaning: <>Una dependencia del SDK de Stellar para JavaScript está en el major actual o en uno más reciente.</>,
      evidence: <><code>{"major N >= current major M"}</code>, con la fuente y la hora de observación.</>,
      todo: <>Nada.</>,
    },
    JS_SDK_UNKNOWN: {
      meaning: <>No se pudo interpretar la versión, o el release actual del SDK de JavaScript no está disponible, así que no se hizo ninguna comparación.</>,
      evidence: <><code>Version unparseable from manifest</code> o <code>Current JS SDK version evidence unavailable</code>.</>,
      todo: <>Declara una versión simple, o busca DATA_DEGRADED y vuelve a ejecutar.</>,
    },
    JS_LEGACY_PACKAGE: {
      meaning: <>El repo depende del paquete heredado <code>soroban-client</code> o del paquete sin scope <code>stellar-sdk</code>.</>,
      evidence: <><code>Legacy package name detected in manifest</code>, con la fuente de referencia y la hora de observación.</>,
      todo: <>Reemplázalo por <code>@stellar/stellar-sdk</code>.</>,
    },
    MANIFEST_UNPARSEABLE: {
      meaning: <>No se pudo leer o interpretar un Cargo.toml, un package.json o un directorio. Sus dependencias no se verificaron.</>,
      evidence: <>El mensaje de error del parser o del sistema de archivos.</>,
      todo: <>Corrige el archivo o el directorio ilegible (por ejemplo, TOML o JSON inválido, o un error de permisos) y vuelve a ejecutar. Hasta entonces, esa ruta queda sin verificar.</>,
    },
    DATA_DEGRADED: {
      meaning: <>Una de las fuentes del ecosistema falló o devolvió datos parciales, o se usó un snapshot en caché vencido o de respaldo. Los veredictos relacionados pueden quedar como desconocidos o incompletos.</>,
      evidence: <><code>{"Reported while collecting the snapshot observed <time>"}</code>. El mensaje nombra la fuente que falló, por ejemplo <code>stellarDocs.get_doc_page: ...</code>. La columna de archivo dice <code>(ecosystem data)</code>.</>,
      todo: <>Vuelve a ejecutar. Si persiste, verifica la disponibilidad de Raven y lee en el mensaje qué fuente falló.</>,
    },
    NO_SDK_FOUND: {
      meaning: <>No se detectó ninguna dependencia de soroban-sdk ni del SDK de Stellar para JavaScript en la ruta escaneada.</>,
      evidence: <><code>{"Scanned Cargo.toml and package.json files under <root>"}</code>.</>,
      todo: <>Revisa la ruta. Las carpetas como node_modules y target se omiten, y el escaneo se detiene cuatro niveles más abajo.</>,
    },
    CLI_DEPRECATED: {
      meaning: <>Un stellar-cli fijado está dos o más majors por detrás de la Stellar CLI actual. Un hallazgo por cada versión fijada; no se reporta nada si el repo no fija ninguna.</>,
      evidence: <>{PIN.slice(0, -1)}. La comparación usa la versión de la Stellar CLI de la página oficial Software Versions.</>,
      todo: <>Actualiza la versión fijada al major actual de la Stellar CLI.</>,
    },
    CLI_BEHIND: {
      meaning: <>Un stellar-cli fijado está exactamente un major por detrás de la Stellar CLI actual.</>,
      evidence: PIN,
      todo: <>Planifica la actualización al major actual.</>,
    },
    CLI_CURRENT: {
      meaning: <>Un stellar-cli fijado está en el major actual (o en uno más reciente).</>,
      evidence: PIN,
      todo: <>Nada.</>,
    },
    CLI_UNKNOWN: {
      meaning: <>Existe un stellar-cli fijado, pero su versión no se puede interpretar (por ejemplo, un nombre de rama o una expresión de CI), o la versión actual de la Stellar CLI no está disponible, así que no se emite ningún veredicto.</>,
      evidence: PIN,
      todo: <>Fija una versión simple, o busca DATA_DEGRADED y vuelve a ejecutar.</>,
    },
    RUST_TARGET_LEGACY: {
      meaning: <>wasm32-unknown-unknown está declarado en un repo con soroban-sdk y sin wasm32v1-none. La Stellar CLI 23+ compila para wasm32v1-none. Un hallazgo por cada lugar donde se declara.</>,
      evidence: <>El archivo y la línea que lo declaran, como rust-toolchain.toml, .cargo/config.toml, un workflow, un Makefile o un script.</>,
      todo: <>Ejecuta rustup target add wasm32v1-none y decláralo donde está declarado el target heredado.</>,
    },
    RUST_TOOLCHAIN_OLD: {
      meaning: <>Un canal de Rust fijado es anterior a 1.84.0 en un repo con soroban-sdk. La guía de configuración requiere Rust v1.84.0 o posterior. stable y nightly no cuentan como versiones fijadas.</>,
      evidence: <>El canal fijado y el archivo y la línea de donde sale.</>,
      todo: <>Sube el canal fijado a 1.84.0 o posterior.</>,
    },
  },
} satisfies DocsFindingsDict;
