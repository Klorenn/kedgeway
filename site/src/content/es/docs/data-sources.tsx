import type { DocsDataSourcesDict } from "../../schema/docs-data-sources";

export default {
  meta: { title: "Fuentes de datos — documentación de kedgeway", description: "De dónde obtiene kedgeway la información de referencia, cómo resuelve los conflictos y qué significa DATA_DEGRADED." },
  h1: "Fuentes de datos",
  lede: <>kedgeway no incluye una lista de versiones. En cada ejecución consulta al servidor MCP Stellar Raven (<code>https://raven.stellar.org/mcp</code>) con una sola llamada.</>,
  askH: "Qué consulta",
  askCols: { source: "Fuente", usedFor: "Para qué se usa" },
  ask: {
    docPage: { source: <><code>stellarDocs.get_doc_page</code> sobre <code>/docs/networks/software-versions</code></>, use: <>La página oficial Software Versions: el soroban-sdk actual, el SDK de JavaScript actual y la versión del protocolo.</> },
    scout: { source: <><code>scout.analyzeEcosystem</code> (toolchain)</>, use: <>El índice de toolchains del ecosistema de Scout: una muestra de repos con versiones obsoletas de soroban-sdk.</> },
    search: { source: <><code>stellarDocs.search_docs</code></>, use: <>Notas de actualización y migración. Los cinco primeros resultados (título, URL y un fragmento corto) se guardan en el snapshot. <code>diagnose</code> no los imprime. <code>migrate</code> cita un resultado solo cuando su título o URL es un documento de migración.</> },
  },
  winsH: "Qué fuente tiene prioridad",
  wins: {
    docs: <>La página oficial de documentación es la autoridad sobre qué es lo actual.</>,
    scout: <>La lista de obsoletos de Scout es una <strong>muestra con un máximo de 50</strong>. Una entrada de Scout solo cuenta cuando está por debajo del major actual según la documentación.</>,
    behind: <>Una dependencia con más de un major de atraso se considera obsoleta aunque Scout no la liste.</>,
  },
  provenanceH: "Procedencia en cada hallazgo",
  provenance: <>Cada hallazgo cita su fuente y la hora en que se observó. El encabezado del reporte muestra el major actual de soroban-sdk y la hora de observación, una marca de tiempo ISO 8601 en UTC tomada cuando la ejecución consultó a Raven.</>,
  degradedH: "DATA_DEGRADED",
  degradedIntro: <>Si una fuente falla o devuelve algo que kedgeway no puede leer, la ejecución no se detiene y no adivina. Registra una nota, y cada nota se convierte en un hallazgo DATA_DEGRADED. Las notas nombran la fuente, por ejemplo:</>,
  degradedFallback: <>Cuando falta el major actual de soroban-sdk, los hallazgos del repo pasan a SDK_UNKNOWN y no se afirma que nada sea obsoleto.</>,
  cacheH: "Caché del snapshot",
  cacheIntro: <>Después de cada consulta exitosa a Raven, kedgeway escribe el snapshot del ecosistema en <code>$XDG_CACHE_HOME/kedgeway/snapshot.json</code> (por defecto <code>~/.cache/kedgeway/</code>, con modo de archivo 0600 y de carpeta 0700). Las ejecuciones siguientes lo reutilizan.</>,
  cacheCols: { situation: "Situación", happens: "Qué pasa" },
  cache: {
    fresh: { label: <>Caché vigente</>, text: <>Más reciente que <code>--max-age</code> (por defecto <code>24h</code>) y sin fecha en el futuro: se usa sin llamar a Raven.</> },
    stale: { label: <>Caché vencida</>, text: <>Se vuelve a consultar. Si Raven falla, se usa la caché vencida y un hallazgo <code>DATA_DEGRADED</code> dice <code>using cached snapshot from &lt;observedAt&gt;</code>.</> },
    offline: <>Nunca llama a Raven. Sale con 1 si no hay caché. Una caché vencida se usa con un hallazgo <code>DATA_DEGRADED</code> como <code>snapshot is N hours old</code>.</>,
    noCache: <>No lee la caché ni usa el respaldo ante fallas, pero igual escribe el snapshot nuevo.</>,
    maxAge: <>La antigüedad máxima de un snapshot en caché: <code>30s</code>, <code>15m</code>, <code>24h</code> o <code>2d</code>.</>,
  },
  cacheNotes: {
    degraded: <>Un snapshot con notas <code>DATA_DEGRADED</code> nunca se escribe en la caché, y uno en caché que tenga notas cuenta como vencido.</>,
    flags: <><code>--offline</code> con <code>--no-cache</code> se rechaza (salida 1). <code>--offline</code> se ignora, con una advertencia, cuando se usa <code>--fixture</code>. <code>--fixture</code> omite la caché por completo.</>,
    global: <>La caché es un único archivo global. <code>--max-age</code> se aplica a su <code>observedAt</code>.</>,
  },
} satisfies DocsDataSourcesDict;
