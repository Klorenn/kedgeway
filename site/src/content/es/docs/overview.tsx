import type { DocsOverviewDict } from "../../schema/docs-overview";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Descripción general — documentación de kedgeway", description: "Qué es kedgeway y qué no es, cómo razona y qué leer después." },
  h1: "Descripción general",
  lede: <>kedgeway es una herramienta de línea de comandos que te dice qué tan desactualizado está el toolchain de un repo de Stellar o Soroban. Lee tus manifiestos, le pregunta al ecosistema en vivo cuál es la versión actual y reporta la diferencia con sus fuentes.</>,
  isH: "Qué es",
  is: {
    cli: <>Una CLI que escanea <code>Cargo.toml</code> (<code>soroban-sdk</code>) y <code>package.json</code> (<code>@stellar/stellar-sdk</code>, <code>@stellar/stellar-base</code> y los paquetes heredados <code>soroban-client</code> y <code>stellar-sdk</code>).</>,
    grounded: <>Basada en datos en vivo del servidor MCP Stellar Raven: la página oficial Software Versions y el índice de toolchains del ecosistema de Scout.</>,
    evidence: <>La evidencia primero. Cada hallazgo cita su fuente y la hora en que se observó.</>,
    honest: <>Honesta ante las fallas. Si no se puede acceder a una fuente, el reporte dice <code>DATA_DEGRADED</code> en lugar de adivinar.</>,
  },
  isNotH: "Qué no es",
  isNot: {
    rewriter: <>No reescribe código. <code>diagnose</code> nunca modifica tu repo. La <L to="/docs/migrate">migración</L> imprime una guía y actualiza las cadenas de versión. Nunca ejecuta <code>cargo</code> ni <code>npm</code>.</>,
    lockfile: <>No es un auditor completo de lockfiles. Usa la versión resuelta de la dependencia directa cuando un lockfile compatible da un único resultado y, si no, recurre al manifiesto.</>,
    audit: <>No es una auditoría de seguridad ni de contratos. Solo mide el desfase de versión del SDK.</>,
    service: <>No es un servicio. El contenido de tu repo nunca sale de tu máquina. Consulta <L to="/docs/authentication">Autenticación</L>.</>,
  },
  thinksH: "Cómo razona",
  thinks: {
    scan: <><strong>Escanear.</strong> Recorre el repo y reúne las dependencias del SDK desde los manifiestos.</>,
    ask: <><strong>Consultar a Raven.</strong> Obtiene las versiones actuales y la muestra de obsoletos una vez por ejecución.</>,
    diagnose: <><strong>Diagnosticar.</strong> Compara cada dependencia con el ecosistema e imprime los hallazgos por severidad.</>,
  },
  nextH: "Qué leer después",
} satisfies DocsOverviewDict;
