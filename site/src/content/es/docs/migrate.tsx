import type { DocsMigrateDict } from "../../schema/docs-migrate";

export default {
  meta: { title: "Guía de migración — documentación de kedgeway", description: "Una guía de migración a partir del snapshot en vivo y luego cambios acotados de versión del SDK." },
  h1: "Guía de migración",
  lede: <>Una guía a partir del snapshot y luego una edición acotada de las cadenas de versión. No reescribe tu código fuente.</>,
  guideH: "La guía",
  guideIntro: <>Un dry run la imprime antes del diff.</>,
  guide: {
    where: <>Dónde está la dependencia, la versión que publica Stellar, el protocolo y la hora de observación. Si el snapshot no tiene número de protocolo, la guía lo indica.</>,
    steps: <>Pasos numerados: la cadena de versión que kedgeway va a cambiar, los comandos que ejecutas y una verificación de que tu Stellar CLI y la red donde haces deploy usen ese protocolo. kedgeway no lee ninguno de los dos.</>,
    legacy: <>Para <code>soroban-client</code> y el <code>stellar-sdk</code> sin scope, los archivos y las líneas que los importan, hasta 20. La búsqueda usa la misma profundidad y los mismos directorios omitidos que el escaneo de manifiestos, y no sigue enlaces simbólicos.</>,
    docs: <>Resultados de documentación de Raven cuyo título o URL es un documento de migración. Se omite una página que solo menciona una migración dentro de un fragmento. Si ninguno califica, la guía dice que no se obtuvo ninguna guía de actualización.</>,
  },
  runH: "Ejecútalo",
  changesH: "Qué cambia",
  changes: {
    rust: <><strong>Rust.</strong> Un <code>soroban-sdk</code> obsoleto o atrasado se actualiza a la versión actual exacta (por ejemplo <code>28.0.0</code>). Solo cambia la cadena de versión entre comillas en esa línea, así que se conservan los comentarios, <code>features</code> y el formato. Los miembros con <code>workspace = true</code> no se tocan y, en su lugar, se actualiza la raíz del workspace. Se conservan los prefijos <code>=</code>, <code>~</code> y <code>^</code>; los demás rangos (<code>&gt;=</code>, <code>&lt;</code>) pasan a ser pasos manuales.</>,
    js: <><strong>JavaScript.</strong> <code>@stellar/stellar-sdk</code> se actualiza a la versión actual y conserva <code>^</code> o <code>~</code> (las versiones fijadas siguen siendo exactas). <code>package.json</code> conserva el orden de sus claves y su sangría.</>,
    legacy: <><strong>Paquetes heredados.</strong> <code>soroban-client</code> y el <code>stellar-sdk</code> sin scope se reemplazan por <code>@stellar/stellar-sdk</code> en <code>^current</code>, junto con un paso manual que lista patrones de <code>rg</code> para los imports que debes actualizar tú.</>,
    aliases: <><strong>Alias.</strong> Un miembro como <code>&quot;stellar-sdk&quot;: &quot;npm:@stellar/stellar-sdk@^12.0.0&quot;</code> se lee como el paquete real. Una actualización reescribe el valor en su lugar a <code>npm:@stellar/stellar-sdk@^&lt;current&gt;</code> y conserva el prefijo. Un alias de un paquete heredado se reemplaza por completo por <code>&quot;@stellar/stellar-sdk&quot;: &quot;^&lt;current&gt;&quot;</code>. Un alias sin versión pasa a ser un paso manual.</>,
  },
  refusesH: "Qué se niega a hacer",
  refuses: {
    base: <><code>@stellar/stellar-base</code> es un paso manual, porque el snapshot no tiene una versión actual de base.</>,
    noRun: <>Nunca ejecuta <code>cargo</code> ni <code>npm</code>. En su lugar, imprime los comandos que siguen: <code>cargo update -p soroban-sdk</code> y <code>npm install</code>.</>,
    git: <><code>--write</code> se rechaza si un archivo que tocaría tiene cambios sin commit en git. La verificación pasa en silencio solo cuando git no está instalado o la ruta no está en un repositorio. Cualquier otra falla de git también rechaza la escritura.</>,
    manual: <>Todo lo que no puede hacer de forma segura se lista como paso manual con su motivo. Solo se editan versiones simples: <code>12.x</code>, <code>12 || 13</code> y los rangos con comas pasan a ser pasos manuales, y las dependencias en <code>peerDependencies</code>, <code>optionalDependencies</code>, <code>overrides</code> o <code>resolutions</code> no se tocan. kedgeway nunca adivina.</>,
    exact: <>Las ediciones son exactas a nivel de byte: en <code>package.json</code> solo cambian los fragmentos afectados, y las escrituras son atómicas. Nunca se editan manifiestos que sean enlaces simbólicos.</>,
  },
  lockfilesH: "Lockfiles",
  lockfiles: {
    resolved: <><code>migrate</code> decide a partir de la versión <strong>resuelta</strong> cuando existe un lockfile y luego edita solo el <strong>manifiesto</strong>. Nunca edita un lockfile.</>,
    refresh: <>Cuando el manifiesto ya admite el major actual pero el lockfile fija una versión anterior, una actualización no cambiaría nada. En su lugar, kedgeway emite un paso manual para refrescar el lockfile: <code>cargo update -p soroban-sdk</code>, <code>npm update &lt;name&gt;</code>, <code>pnpm update &lt;name&gt;</code> o <code>yarn upgrade &lt;name&gt;</code>.</>,
    reminder: <>Siempre que un archivo del plan tiene lockfile, el plan también te recuerda que las ediciones no lo actualizan.</>,
  },
  exitH: "Códigos de salida",
  exitCols: { code: "Código", meaning: "Significado" },
  exit: {
    ok: <>No hay nada que hacer, solo hay pasos manuales en un dry run, o las ediciones se aplicaron sin problemas.</>,
    gate: <>Un dry run tiene al menos una edición automática (para que CI pueda bloquear con eso), o <code>--write</code> no pudo aplicar algún paso.</>,
    error: <>Error, incluida una escritura rechazada.</>,
  },
  warning: <>Un cambio de major puede traer cambios de API incompatibles que kedgeway no reescribe. Revisa siempre el diff y ejecuta tus tests.</>,
} satisfies DocsMigrateDict;
