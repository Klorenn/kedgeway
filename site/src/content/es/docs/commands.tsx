import type { DocsCommandsDict } from "../../schema/docs-commands";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Comandos — documentación de kedgeway", description: "Cada comando, flag y código de salida de kedgeway." },
  h1: "Comandos",
  lede: <>Siete comandos: <code>diagnose</code>, <code>init</code>, <code>login</code>, <code>logout</code>, <code>doctor</code>, <code>migrate</code> y <code>mcp</code>. Además de <code>--version</code>.</>,
  versionP: <>Muestra la versión instalada, leída de <code>package.json</code>, y sale con 0.</>,
  diagnoseP: <>Escanea el repo en <code>path-or-url</code> (por defecto, el directorio actual), obtiene los datos del ecosistema e imprime un reporte. Usa Raven, salvo que pases <code>--fixture</code>. La fuente es una ruta local, una URL de git (<code>https://</code>, <code>ssh://</code> o <code>git@host:owner/repo</code>) o la forma corta de GitHub <code>owner/repo</code>. Un directorio local existente tiene prioridad sobre la forma corta. Una fuente remota se clona de forma superficial en un directorio temporal y se borra al terminar. Consulta <L to="/docs/what-it-scans#remote-repositories">Repositorios remotos</L>.</>,
  diagnoseFlags: {
    ref: <>Rama o tag que se escanea cuando la fuente es un repositorio remoto. Puede repetir el <code>/tree/&lt;ref&gt;</code> de la URL, pero no contradecirlo. Con una ruta local es un error y sale con 1. También en <code>migrate</code>.</>,
    json: <>Muestra el diagnóstico como JSON en lugar de texto. El objeto tiene <code>findings</code> (cada uno con <code>severity</code>, <code>code</code>, <code>message</code>, <code>file</code>, <code>evidence</code>) y <code>summary</code> (<code>critical</code>, <code>warning</code>, <code>info</code>).</>,
    format: <>Elige el formato de stdout. <code>--json</code> equivale a <code>--format json</code>; usar ambos sale con 1. <code>annotations</code> imprime un comando de workflow de GitHub por hallazgo (<code>::error</code>, <code>::warning</code>, <code>::notice</code>, con el archivo de manifiesto y la línea) y luego el reporte de texto normal.</>,
    sarif: <>También escribe un log SARIF 2.1.0 en <code>file</code>. Stdout sigue respetando <code>--format</code>.</>,
    annotations: <>También escribe las anotaciones de GitHub en <code>file</code>. Stdout sigue respetando <code>--format</code>. La línea sale de un escaneo aproximado del manifiesto. Consulta <L to="/docs/github-action">GitHub Action</L>.</>,
    offline: <>Usa solo el snapshot del ecosistema en caché y nunca llama a Raven. Sale con 1 si no hay caché; contradice <code>--no-cache</code>; se ignora con una advertencia cuando hay <code>--fixture</code>. También en <code>migrate</code>. En <code>doctor</code>, el mismo flag solo omite la verificación de conexión con Raven.</>,
    noCache: <>Ignora el snapshot en caché y obtiene los datos en vivo. El resultado se guarda igual en la caché. También en <code>migrate</code>.</>,
    maxAge: <>Antigüedad máxima de un snapshot en caché antes de volver a obtenerlo: <code>30s</code>, <code>15m</code>, <code>24h</code>, <code>2d</code>. Por defecto, <code>24h</code>. También en <code>migrate</code>. Consulta <L to="/docs/data-sources">Fuentes de datos</L>.</>,
    fixture: <>Lee el snapshot del ecosistema desde un archivo JSON en lugar de llamar a Raven. No requiere iniciar sesión. Consulta <L to="/docs/fixtures">Fixtures</L>.</>,
    failOn: <>Termina con código 2 si algún hallazgo está en <code>critical</code>, <code>warning</code> o <code>info</code>, o por encima. Cualquier otro valor es un error y sale con 1.</>,
  },
  initP: <>Escribe <code>.github/workflows/kedgeway.yml</code> dentro de <code>path</code> (por defecto, el directorio actual). El workflow se ejecuta con cada push a <code>main</code> o <code>master</code> y en los pull requests, y usa <code>Klorenn/kedgeway@v&lt;installed version&gt;</code> con <code>path: .</code>, <code>fail-on: warning</code> y <code>auth: $&#123;&#123; secrets.KEDGEWAY_AUTH &#125;&#125;</code>. Después, crea el secreto de repositorio <code>KEDGEWAY_AUTH</code> con la salida de <code>kedgeway login --export</code>. Consulta <L to="/docs/github-action#quick-start">GitHub Action</L>.</>,
  initFlags: {
    force: <>Sobrescribe un archivo de workflow existente. Sin ella, el archivo existente queda igual y el comando sale con 1.</>,
    print: <>Muestra el YAML del workflow en stdout y no escribe nada.</>,
  },
  initExit: <>Sale con 0 si todo sale bien. Sale con 1 si el archivo existe y no se usó <code>--force</code>, o si falla la escritura.</>,
  loginP: <>Inicia una autorización OAuth nueva con Stellar Raven y guarda el token. Imprime <code>Logged in to Stellar Raven.</code> si funciona. Consulta <L to="/docs/authentication">Autenticación</L>.</>,
  loginNoBrowser: <><code>login --no-browser</code> es para máquinas sin navegador. Muestra la URL de autorización en lugar de abrirla. Abre la URL en cualquier lugar, inicia sesión y pega la URL de redirección (o solo su <code>code</code>) en la terminal. Una URL pegada se compara con el state de OAuth del intento de inicio de sesión; un código suelto no lleva state. También puedes reenviar el puerto del callback con <code>ssh -L</code> para que la redirección llegue directamente a kedgeway. Se combina con <code>--export</code>. Consulta <L to="/docs/authentication#headless">Inicio de sesión sin navegador</L>.</>,
  loginExport: <><code>login --export</code> imprime tus credenciales guardadas como un secreto en base64 para CI y no borra nada. Solo inicia sesión antes si no hay nada guardado, y abre un navegador salvo que también pases <code>--no-browser</code>. Stdout es el secreto; stderr advierte que lo es. Si <code>KEDGEWAY_AUTH</code> ya está definida en el entorno, ese valor se ignora y se exporta el inicio de sesión guardado. Pon la salida en un secreto <code>KEDGEWAY_AUTH</code>. Consulta <L to="/docs/ci">CI</L>.</>,
  logoutP: <>Borra las credenciales guardadas. Imprime si se borró algo y sale con 0 en ambos casos.</>,
  doctorP: <>Una autoverificación que no cambia nada. Imprime una línea por verificación, <code>ok</code>, <code>warn</code>, <code>fail</code> o <code>skip</code>:</>,
  doctorChecks: {
    node: <>Versión de Node (22.12 o más reciente).</>,
    auth: <>Autenticación: una <code>KEDGEWAY_AUTH</code> válida en el entorno, un <code>auth.json</code> con tokens, o ninguna.</>,
    cache: <>Caché de snapshots: ruta y antigüedad.</>,
    stellar: <>Stellar CLI: ejecuta <code>stellar --version</code> sin shell (límite de 5 segundos). Si no está instalada da <code>warn</code>, porque es opcional (<a href="https://developers.stellar.org/docs/tools/cli/install-cli">guía de instalación</a>). Con un snapshot en caché, el major actual o uno más nuevo da <code>ok</code>, un major de atraso da <code>warn</code> y dos o más dan <code>fail</code>. Con <code>--offline</code> o sin snapshot da <code>ok</code> y solo reporta la versión instalada.</>,
    raven: <>Conexión con Raven: una llamada <code>search</code> liviana con un límite de 10 segundos. <code>--offline</code> la omite. Usa una copia de solo lectura de tus credenciales, así que renovar el token no puede modificar <code>auth.json</code>.</>,
  },
  doctorExit: <>Sale con 0 cuando nada falló (las advertencias no lo hacen fallar) y con 1 cuando falló alguna verificación.</>,
  migrateP: <>Imprime una guía de migración y un diff unificado de los cambios de versión del SDK. Por defecto es un dry run, y <code>--dry-run</code> es ese mismo modo de forma explícita. <code>--write</code> aplica los cambios al manifiesto. Pasar <code>--dry-run</code> y <code>--write</code> a la vez sale con 1. <code>--offline</code>, <code>--no-cache</code> y <code>--max-age</code> funcionan igual que en <code>diagnose</code>. Sale con 0 si no hay nada que hacer, si el dry run solo tiene pasos manuales o si se aplicaron los cambios; con 2 si un dry run tiene al menos un cambio automático o si una escritura omitió algún paso; con 1 ante un error, incluida una escritura rechazada. Solo edita manifiestos y avisa de cualquier lockfile que quede desactualizado, con un paso manual para regenerarlo. Consulta la <L to="/docs/migrate">guía de migración</L>.</>,
  migrateRemote: <><code>path-or-url</code> acepta las mismas fuentes que <code>diagnose</code>. Migrar una fuente remota solo admite dry run: <code>--write</code> sale con 2 e imprime <code>remote sources are dry-run only; clone it and run migrate locally</code>.</>,
  mcpP: <>Ejecuta un servidor MCP por stdio. Nunca inicia OAuth: primero inicia sesión. <code>--allow-write</code> permite que la herramienta migrate edite archivos; sin ella, <code>write: true</code> devuelve un error y los dry runs siguen funcionando. Consulta <L to="/docs/mcp">Servidor MCP</L>.</>,
  exitH: "Códigos de salida",
  exitHead: { code: "Código", meaning: "Significado" },
  exitRows: {
    "0": <><code>diagnose</code>: terminó y no se alcanzó ningún umbral de <code>--fail-on</code>. <code>migrate</code>: nada que hacer, solo pasos manuales, o se aplicaron los cambios. <code>init</code>: el workflow se escribió, o se imprimió con <code>--print</code>. <code>doctor</code> y <code>logout</code>: terminaron. Un <code>warn</code> de <code>doctor</code> igual sale con 0.</>,
    "1": <>Error de la herramienta: un flag no válida (incluidas <code>--fail-on</code>, <code>--format</code> o <code>--max-age</code>), <code>--json</code> combinada con <code>--format</code>, <code>--offline</code> con <code>--no-cache</code>, una falla al iniciar sesión, una verificación de <code>doctor</code> fallida, <code>init</code> con un workflow existente sin <code>--force</code> o sin poder escribirlo, o una falla de escaneo o de red.</>,
    "2": <><code>diagnose</code>: un hallazgo alcanzó <code>--fail-on</code>. <code>migrate</code>: un dry run tiene un cambio automático, <code>--write</code> omitió un paso, o se pasó <code>--write</code> con una fuente remota. <code>doctor</code> nunca sale con 2.</>,
  },
  exitAfter: <><code>logout</code> sale con 0 se haya borrado o no un archivo de credenciales. <code>--help</code> sale con 0. Un comando o un flag desconocidos salen con 1.</>,
} satisfies DocsCommandsDict;
