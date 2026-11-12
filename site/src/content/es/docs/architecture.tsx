import type { DocsArchitectureDict } from "../../schema/docs-architecture";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Arquitectura — documentación de kedgeway", description: "Cómo está organizado kedgeway: núcleo puro, puertos, adaptadores y la CLI." },
  h1: "Arquitectura",
  lede: <>kedgeway es hexagonal: las reglas son puras y todo lo que toca el mundo exterior está detrás de un puerto.</>,
  cols: { layer: "Capa", files: "Archivos", role: "Función" },
  layers: {
    core: <>Funciones puras. <code>repo-facts</code> analiza manifiestos y versiones; <code>diagnose</code> convierte los datos del repo y un snapshot en hallazgos. Sin E/S.</>,
    ports: <><code>EcosystemPort</code>: un solo método, <code>fetchSnapshot()</code>, que devuelve un snapshot del ecosistema.</>,
    adapters: <><code>fs-repo-scanner</code> recorre el repo. <code>raven-ecosystem</code>, <code>raven-auth</code> y <code>raven-parse</code> son el cliente MCP de Raven, el OAuth y el parser de resultados. <code>fake-ecosystem</code> carga fixtures.</>,
    cli: <>Comandos, flags, formato del reporte y códigos de salida. Conecta los adaptadores con el núcleo.</>,
  },
  flowH: "Flujo de una ejecución",
  flow: {
    scan: <>El escáner produce los <em>datos del repo</em>: dependencias de Rust y JavaScript, más los errores de manifiesto.</>,
    port: <>Un <code>EcosystemPort</code> (Raven, o el falso a partir de un fixture) produce un snapshot.</>,
    diagnose: <><code>diagnose(facts, snapshot)</code> devuelve los hallazgos y un resumen.</>,
    print: <>La CLI los imprime y calcula el código de salida.</>,
  },
  testsH: "Tests",
  tests: <>Los tests están junto al código como <code>*.test.ts</code> y se ejecutan con Vitest (<code>npm test</code>). El desarrollo es test-first: primero escribe el test que falla y luego la regla.</>,
  ruleH: "Agregar una regla",
  rule: {
    test: <>Escribe un test que falle en <code>src/core/diagnose.test.ts</code> con los datos y el snapshot que deberían activarla.</>,
    logic: <>Agrega la lógica en <code>src/core/diagnose.ts</code> y devuelve un hallazgo con severidad, código, mensaje, archivo y evidencia que cite la fuente del snapshot.</>,
    parser: <>Si la regla necesita un dato nuevo, primero extiende el parser en <code>src/core/repo-facts.ts</code>, con tests.</>,
    docs: <>Documenta el código en la página <L to="/docs/findings">Hallazgos</L>.</>,
  },
} satisfies DocsArchitectureDict;
