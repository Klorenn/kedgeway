import type { DocsFixturesDict } from "../../schema/docs-fixtures";

export default {
  meta: { title: "Fixtures — documentación de kedgeway", description: "El formato JSON del snapshot del ecosistema que usa --fixture, con un ejemplo completo." },
  h1: "Fixtures",
  lede: <>Un fixture es un snapshot guardado del ecosistema. Pásalo con <code>--fixture</code> para ejecutar sin Raven: en pruebas, máquinas sin conexión y CI.</>,
  shapeH: "Estructura",
  cols: { field: "Campo", type: "Tipo", notes: "Notas" },
  fields: {
    observedAt: { type: "string", notes: <>Obligatorio. Cuándo se tomó el snapshot, en ISO 8601.</> },
    currentMajor: { type: "integer o null", notes: <>Obligatorio. Con null, los hallazgos de soroban-sdk pasan a SDK_UNKNOWN.</> },
    deprecatedVersions: { type: "string[]", notes: <>Obligatorio. Versiones listadas como obsoletas. Solo se comparan sus majors.</> },
    sorobanSource: { type: "string", notes: <>Obligatorio. Se muestra como fuente en los hallazgos.</> },
    currentVersion: { type: "string o null", notes: <>Obligatorio. Con null, los hallazgos de JavaScript pasan a JS_SDK_UNKNOWN.</> },
    jsSource: { type: "string", notes: <>Obligatorio.</> },
    protocolCurrent: { type: "number o null", notes: <>Opcional. Por defecto es null.</> },
    notes: { type: "array", notes: <>Obligatorio, puede estar vacío. Cada elemento tiene <code>title</code>, <code>url</code> y <code>snippet</code> (todos strings).</> },
    degraded: { type: "string[]", notes: <>Opcional. Por defecto está vacío. Cada entrada se convierte en un hallazgo DATA_DEGRADED.</> },
  },
  exampleH: "Ejemplo completo",
  after: <>Un archivo que no coincide con esta estructura hace que la ejecución termine con 1 y un mensaje. Los fixtures no se actualizan solos: el ecosistema avanza y tu fixture no.</>,
} satisfies DocsFixturesDict;
