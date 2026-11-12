import type { DocsAuthenticationDict } from "../../schema/docs-authentication";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Autenticación — documentación de kedgeway", description: "Cómo kedgeway inicia sesión en Stellar Raven, qué guarda y qué envía." },
  h1: "Autenticación",
  lede: <>Los datos del ecosistema en vivo provienen del servidor MCP Stellar Raven, que requiere OAuth. kedgeway inicia tu sesión una vez y guarda el token en tu máquina.</>,
  howH: "Cómo funciona el inicio de sesión",
  how: {
    registration: <><strong>Registro dinámico de cliente.</strong> kedgeway se registra en Raven como un cliente llamado <code>kedgeway</code> con el scope <code>mcp</code>. La herramienta no incluye ningún client secret.</>,
    pkce: <><strong>PKCE.</strong> Se genera un code verifier para el inicio de sesión y se usa para completar el intercambio del código.</>,
    callback: <><strong>Callback local.</strong> kedgeway inicia un servidor HTTP de un solo uso en <code>127.0.0.1</code> para recibir la redirección. Reutiliza el puerto de tu último inicio de sesión cuando puede; si no, el sistema operativo elige uno. La redirección lleva un valor de state que debe coincidir, así que las solicitudes ajenas se ignoran.</>,
    browser: <><strong>Navegador.</strong> La URL de autorización siempre se imprime en stderr. kedgeway también intenta abrirla con <code>open</code> (macOS), <code>xdg-open</code> (Linux) o <code>start</code> (Windows).</>,
    token: <><strong>Token.</strong> El código se intercambia por un token y se guarda.</>,
  },
  wait: <>El callback espera hasta 5 minutos a que autorices.</>,
  whenH: "Cuándo te pide iniciar sesión",
  whenP: <><code>kedgeway login</code> inicia una autorización nueva: primero borra el token guardado, el registro del cliente y el verifier. <code>login --export</code> no los borra. Imprime lo que ya está guardado y solo inicia sesión cuando no hay nada guardado. <code>kedgeway diagnose</code> primero prueba tu token guardado en silencio, sin servidor y sin navegador. Solo si Raven responde 401 inicia el flujo interactivo.</>,
  whereH: "Dónde se guarda el token",
  warning: <>Cualquiera que pueda leer <code>~/.config/kedgeway/auth.json</code> puede usar tu sesión de Raven. kedgeway lo escribe con modo 0600; mantenlo fuera de los respaldos y de los repos, y ejecuta <code>kedgeway logout</code> en máquinas compartidas.</>,
  whereP: <>La carpeta se crea con modo 0700 y el archivo se escribe con modo 0600, mediante un archivo temporal y un cambio de nombre. Contiene los tokens de OAuth, el registro del cliente y el último puerto de callback.</>,
  deleteP: <>Para borrarlo:</>,
  sentH: "Qué se envía a Raven",
  sentP: <>Solo un script fijo, ejecutado con la herramienta <code>execute</code> de Raven. Pide la página Software Versions, el índice de toolchains de Scout y una búsqueda en la documentación. No incluye nada de tu repo. Los nombres de archivo, los manifiestos y las versiones se quedan en tu máquina; la comparación se hace localmente.</>,
  headlessH: "Inicio de sesión sin navegador",
  headlessP: <>El servidor OAuth de Raven solo ofrece authorization code con PKCE y refresh tokens, sin device-code grant, así que no hay flujo <code>--device</code>. En una máquina sin navegador, usa:</>,
  headlessAfter: <>kedgeway imprime la URL de autorización y no intenta abrir un navegador. Ábrela en cualquier navegador e inicia sesión. Después, el navegador se redirige a <code>http://127.0.0.1:&lt;port&gt;/callback</code>, que solo existe en la máquina donde corre kedgeway. Hay dos formas de terminar:</>,
  finish: {
    paste: <><strong>Pégala de vuelta.</strong> Copia la URL de redirección completa (o solo su <code>code</code>) en la terminal y presiona Enter. Una entrada incorrecta muestra un error de una línea y la solicitud se repite.</>,
    forward: <><strong>Reenvía el puerto.</strong> Desde tu propia máquina, antes de iniciar sesión, reenvía el puerto del callback para que la redirección llegue directamente a kedgeway. El puerto está en el <code>redirect_uri</code> de la URL impresa.</>,
  },
  checked: <>Una URL pegada se compara con el state de OAuth del intento de inicio de sesión, y la verificación falla de forma segura: si no hay state para comparar, la URL pegada se rechaza. Un código suelto no lleva state, así que no se puede verificar. Cuando stdin no es una terminal, pegar está deshabilitado y solo el callback puede terminar el inicio de sesión.</>,
  forCi: <>Para CI, haz esto una vez en una máquina de confianza y agrega <code>--export</code> para imprimir el secreto después:</>,
  ciH: "En CI",
  ciP: <>Ejecuta <code>kedgeway login --export</code> para imprimir tus credenciales guardadas como un secreto en base64 y guárdalo en un secreto <code>KEDGEWAY_AUTH</code>. Durante la ejecución, la variable reemplaza a <code>auth.json</code>: nunca se escribe en disco y se renueva solo en memoria, así que un refresh token rotado puede dejarla vencida. Consulta <L to="/docs/ci">CI</L>.</>,
  troubleH: "Solución de problemas",
  trouble: {
    port: { dt: "El puerto está ocupado", dd: <>kedgeway usa otro puerto libre en 127.0.0.1. No tienes que hacer nada.</> },
    browser: { dt: "El navegador no se abrió", dd: <>Copia la URL impresa en la terminal (stderr) en un navegador de la misma máquina. En un servidor sin navegador, consulta <a href="#headless">Inicio de sesión sin navegador</a>.</> },
    timeout: { dt: "Se agotó el tiempo de inicio de sesión", dd: <>El callback se rinde después de 5 minutos. Vuelve a ejecutar <code>kedgeway login</code>.</> },
    rejected: { dt: "El token fue rechazado", dd: <>kedgeway reporta que la autenticación funcionó, pero Raven rechazó el token. Ejecuta <code>kedgeway logout</code> y luego <code>kedgeway login</code>.</> },
  },
} satisfies DocsAuthenticationDict;
