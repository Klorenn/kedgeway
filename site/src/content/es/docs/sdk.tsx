import type { DocsSdkDict } from "../../schema/docs-sdk";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "SDK de TypeScript — documentación de kedgeway", description: "Llama a diagnose y migrate de kedgeway desde tu propio código TypeScript o JavaScript." },
  h1: "SDK de TypeScript",
  lede: <>La CLI funciona sobre una biblioteca. Impórtala para diagnosticar o migrar un repo desde tus propias herramientas.</>,
  installH: "Instalación",
  install: <><code>npm install kedgeway</code>. Requiere Node 22.12 o posterior. Incluye las declaraciones de tipos. Para la CLI, consulta <L to="/docs/getting-started">Primeros pasos</L>.</>,
  esmWarning: <>El paquete es solo ESM. El mapa <code>exports</code> no tiene condición <code>default</code> ni <code>require</code>, así que <code>require(&quot;kedgeway&quot;)</code> no funciona. Usa <code>import</code>.</>,
  apiH: "API",
  cols: { export: "Export", does: "Qué hace" },
  api: {
    diagnose: <>Escanea el repo y devuelve un <code>Diagnosis</code> (<code>findings</code> y <code>summary</code>). Usa Raven en vivo salvo que pases <code>fixture</code> o un <code>ecosystem</code>.</>,
    diagnoseDetailed: <>Las mismas opciones; devuelve <code>{"{ facts, snapshot, diagnosis }"}</code>.</>,
    scanRepo: <>Lee los manifiestos y devuelve <code>RepoFacts</code>. Lanza un error si la ruta no existe o no es un directorio.</>,
    diagnoseRepo: <>El motor de reglas puro: sin I/O.</>,
    createRavenEcosystem: <>Un <code>EcosystemPort</code> respaldado por Stellar Raven. Opciones: <code>authPath</code> e <code>interactive</code> (ponlo en <code>false</code> para fallar de inmediato en lugar de iniciar OAuth).</>,
    fixtures: <>Snapshots sin conexión. Consulta <L to="/docs/fixtures">Fixtures</L>.</>,
    planMigration: <>Construye un <code>MigrationPlan</code> con cambios de versión y pasos manuales.</>,
    buildGuide: <>La guía de migración: versión publicada, protocolo, pasos y las notas de Raven cuyo título o url es un documento de migración.</>,
    findImportHits: <>Búsqueda pura de líneas de import de los paquetes indicados.</>,
    applyMigration: <>Dry run por defecto; solo edita archivos cuando <code>write</code> es true.</>,
    migrate: <>Diagnostica, planifica y aplica en una sola llamada. Agrega <code>write?</code> a las opciones de diagnose.</>,
    toSarif: <>Un log SARIF 2.1.0. Es el mismo documento que <code>diagnose --format sarif</code> o <code>--sarif</code>.</>,
    toAnnotations: <>Comandos de workflow de GitHub, uno por hallazgo. Son las mismas líneas que <code>--format annotations</code>.</>,
  },
  types: <>Tipos: <code>Diagnosis</code>, <code>Finding</code>, <code>Severity</code>, <code>EcosystemSnapshot</code>, <code>RepoFacts</code>, <code>MigrationPlan</code>, <code>MigrationStep</code>, <code>MigrationGuide</code>, <code>SourceHit</code>.</>,
  exampleH: "Ejemplo sin conexión",
  live: <>Para datos en vivo, quita <code>fixture</code> o pasa <code>ecosystem: createRavenEcosystem()</code>. Eso requiere una sesión guardada (<code>kedgeway login</code>).</>,
} satisfies DocsSdkDict;
