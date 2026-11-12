import type { DocsLimitationsDict } from "../../schema/docs-limitations";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Limitaciones — documentación de kedgeway", description: "Lo que kedgeway no hace, para que puedas evaluar su resultado." },
  h1: "Limitaciones",
  lede: <>kedgeway dice lo que no sabe. Estos son los vacíos que debes tener en cuenta.</>,
  note: <>Un reporte limpio es evidencia solo sobre las versiones declaradas. No es una revisión de seguridad de tus contratos.</>,
  items: {
    lockfile: { term: "La lectura de lockfiles es limitada", detail: <>Se leen Cargo.lock, package-lock.json, pnpm-lock.yaml y yarn.lock; pnpm y yarn con un parser mínimo, así que las estructuras poco comunes recurren a la versión del manifiesto. No se lee nada por encima de la raíz del escaneo. Los parsers se probaron con siete lockfiles reales de repositorios públicos, lo que es un corpus, no una garantía: una estructura que no conoce puede recurrir al manifiesto. Los rangos de JS usan <code>semver</code>; los requisitos de Cargo usan un comparador propio.</> },
    annotations: { term: "Las anotaciones son aproximadas", detail: <>La línea de una anotación sale de un escaneo simple del manifiesto (la primera clave que coincide), así que puede apuntar a la línea equivocada en un archivo poco común. Los hallazgos que no se refieren a un archivo no tienen ubicación. GitHub muestra como máximo 10 anotaciones por tipo en cada step y 50 por job; el reporte completo siempre se imprime.</> },
    deviceCode: { term: "No hay inicio de sesión con código de dispositivo", detail: <>Stellar Raven solo ofrece código de autorización y refresh tokens. En un servidor, usa <code>kedgeway login --no-browser</code> y pega la redirección, o reenvía el puerto de callback con <code>ssh -L</code>.</> },
    sample: { term: "La lista de obsoletos es una muestra", detail: <>La muestra de obsoletos de Scout tiene un máximo de 50. Que una versión no aparezca en ella no prueba que sea compatible. kedgeway también considera obsoleto todo lo que esté más de un major atrás.</> },
    docsPage: { term: "Las versiones actuales salen de una página de documentación", detail: <>Se leen de la página oficial Software Versions. Si esa página cambia de estructura, la lectura puede fallar, y el reporte lo indica con DATA_DEGRADED.</> },
    raven: { term: "Raven tiene que estar disponible", detail: <>Una ejecución en vivo necesita acceso a la red y una sesión válida en Raven. Sin conexión, usa <code>--offline</code> (el snapshot en caché) o <code>--fixture</code>. Para CI, exporta la sesión a un secreto <code>KEDGEWAY_AUTH</code>; puede quedar vencido si Raven rota los refresh tokens.</> },
    migration: { term: "La migración es acotada", detail: <><code>kedgeway migrate</code> imprime una guía y actualiza las versiones en los manifiestos. Lista los pasos manuales, señala hasta 20 imports heredados y cita un documento de Raven solo cuando su título o URL es un documento de migración. No reescribe código fuente y nunca ejecuta cargo ni npm.</> },
    versions: { term: "Solo versiones", detail: <>Mide el desfase de versión del SDK. No audita la lógica de los contratos, la seguridad ni el comportamiento en ejecución.</> },
    scan: { term: "Límites del escaneo", detail: <>Cuatro carpetas de profundidad, y se omiten las carpetas comunes de build y de dependencias. Consulta <L to="/docs/what-it-scans">Qué escanea</L>.</> },
    platforms: { term: "Plataformas", detail: <>Se desarrolla y verifica en macOS. El código que abre el navegador tiene una rama para Windows, pero Windows no se ha verificado.</> },
  },
} satisfies DocsLimitationsDict;
