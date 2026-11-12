import type { DocsGithubActionDict } from "../../schema/docs-github-action";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "GitHub Action — documentación de kedgeway", description: "Ejecuta kedgeway en GitHub Actions y haz fallar un build por desfase del SDK." },
  h1: "GitHub Action",
  lede: <>Ejecuta kedgeway en cada pull request y haz fallar el build cuando un hallazgo alcance tu umbral.</>,
  quickH: "Inicio rápido",
  quick: <>Esto escribe <code>.github/workflows/kedgeway.yml</code>, fijado a la versión instalada. Después agrega el secreto: ejecuta <code>kedgeway login --export</code> y guarda su salida como un secreto del repositorio llamado <code>KEDGEWAY_AUTH</code>. Usa <code>--print</code> para ver el YAML antes de escribirlo y <code>--force</code> para sobrescribir un archivo existente. Consulta <L to="/docs/commands#init">Comandos</L>.</>,
  useH: "Úsala",
  pin: <>Fija un tag de release como en el ejemplo. <code>@main</code> no está fijado y puede cambiar sin aviso.</>,
  ioH: "Entradas y salidas",
  cols: { input: "Entrada", default: "Valor por defecto", meaning: "Significado" },
  inputs: {
    path: { def: <code>.</code>, meaning: <>Directorio que se escanea.</> },
    repo: { def: "ninguno", meaning: <>URL del repositorio u <code>owner/repo</code> para escanear en lugar de <code>path</code>. Se clona en modo shallow y se elimina al terminar. No se emiten anotaciones para él, porque sus rutas no están en el checkout.</> },
    "fail-on": { def: <code>warning</code>, meaning: <>Falla ante cualquier hallazgo de esta severidad o superior. Vacío lo desactiva.</> },
    fixture: { def: "ninguno", meaning: <>JSON del snapshot del ecosistema (sin conexión). Define este <strong>o</strong> <code>auth</code>.</> },
    auth: { def: "ninguno", meaning: <>Credenciales de Raven obtenidas con <code>kedgeway login --export</code>, como secreto. Define este <strong>o</strong> <code>fixture</code>.</> },
    json: { def: <code>false</code>, meaning: <>Imprime JSON en lugar de texto.</> },
    sarif: { def: <code>false</code>, meaning: <>Escribe además SARIF 2.1.0 en <code>$RUNNER_TEMP/kedgeway.sarif</code>.</> },
    version: { def: "el tag fijado", meaning: <>Versión de kedgeway que se ejecuta. Acepta un semver como <code>1.2.3</code>, o <code>source</code> para forzar el build desde el código fuente.</> },
    annotations: { def: "activado en Actions", meaning: <>Emite una anotación de GitHub, con archivo y línea, por cada hallazgo. Usa <code>&quot;false&quot;</code> para desactivarlo.</> },
  },
  outputs: <>Salidas: <code>summary</code> (por ejemplo <code>critical=0 warning=1 info=2</code>), <code>report-json</code> (la ruta del reporte JSON dentro de <code>RUNNER_TEMP</code>) y <code>sarif</code> (la ruta del archivo SARIF, solo cuando <code>sarif</code> está activado).</>,
  requiredH: "Se requiere auth o un fixture",
  required: <>La action necesita una de dos entradas y, si no defines ninguna, nombra ambas.</>,
  requiredItems: {
    auth: <><code>auth</code>: tu secreto <code>KEDGEWAY_AUTH</code>, para datos en vivo de Raven. Expórtalo con <code>kedgeway login --export</code>.</>,
    fixture: <><code>fixture</code>: un snapshot incluido en un commit (consulta <L to="/docs/fixtures">Fixtures</L>). Sin conexión y determinista; tú lo actualizas.</>,
  },
  staleWarning: <>El secreto solo se renueva en memoria. Si Raven rota los refresh tokens, el secreto puede quedar vencido y hay que volver a exportarlo cuando las ejecuciones empiecen a fallar. Trátalo como una contraseña.</>,
  annotationsH: "Anotaciones",
  annotations: <>Con <code>annotations</code> activado, que es el valor por defecto cuando la action corre en GitHub, cada hallazgo se convierte en un comando de workflow que apunta a la línea de la dependencia en su manifiesto. Critical es <code>::error</code>, warning es <code>::warning</code> e info es <code>::notice</code>. En un pull request aparecen sobre los archivos modificados del diff. No hace falta ningún permiso ni paso adicional.</>,
  annotationItems: {
    caps: <>GitHub limita las anotaciones a 10 por tipo (error, warning, notice) por paso y a 50 por job. En un repo grande solo se ven las primeras; el reporte completo se sigue imprimiendo en el log.</>,
    noFile: <>Los hallazgos que no se refieren a un archivo, como <code>DATA_DEGRADED</code> y <code>NO_SDK_FOUND</code>, no tienen archivo y aparecen en la ejecución.</>,
    line: <>La línea sale de un escaneo simple del manifiesto (la primera clave que coincide), así que es aproximada. Las rutas son relativas al directorio desde el que corre la action.</>,
    sanitised: <>El texto de los hallazgos se sanea antes de imprimirse, así que un manifiesto no puede inyectar comandos de workflow.</>,
  },
  annotationsOutside: <>Fuera de Actions, usa <code>kedgeway diagnose --format annotations</code> o <code>--annotations &lt;file&gt;</code>. Consulta <L to="/docs/commands">Comandos</L>. SARIF, más abajo, es independiente y se mantiene: alimenta code scanning, y las anotaciones alimentan el diff.</>,
  sarifH: "SARIF y code scanning",
  sarif: <>El log tiene una ejecución para la herramienta <code>kedgeway</code>, una regla por código de hallazgo (18) y un resultado por hallazgo con la ruta del manifiesto relativa al repo. Critical es un error, warning es una advertencia e info es una nota. Los hallazgos que no se refieren a un archivo, como <code>DATA_DEGRADED</code> y <code>NO_SDK_FOUND</code>, no tienen ubicación.</>,
  exitH: "Códigos de salida y velocidad",
  exit: <>La action ejecuta <code>diagnose</code> una vez, siempre escribe sus salidas y termina con el código de la CLI: 0 cuando nada alcanzó el umbral, 2 cuando un hallazgo lo alcanzó y 1 ante un error de la herramienta. Fijar un tag de release (<code>uses: Klorenn/kedgeway@v1.2.3</code>) instala exactamente esa versión desde npm sin paso de build, y falla con un error claro si la versión no está publicada. Cualquier otra ref (<code>@main</code>, un SHA de commit, una rama) compila el código fuente del checkout con <code>npm ci &amp;&amp; npm run build</code>, que es más lento, y <code>@main</code> no está fijado. La instalación desde npm aplica a los tags creados después de este cambio; <code>v0.1.0</code> todavía compila desde el código fuente.</>,
} satisfies DocsGithubActionDict;
