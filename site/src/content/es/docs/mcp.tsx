import type { DocsMcpDict } from "../../schema/docs-mcp";
import { linkFor } from "@/i18n/Link";

const L = linkFor("es");

export default {
  meta: { title: "Servidor MCP — documentación de kedgeway", description: "Ejecuta kedgeway como servidor MCP para que los asistentes de IA puedan diagnosticar y migrar un repo." },
  h1: "Servidor MCP",
  lede: <><code>kedgeway mcp</code> ejecuta un servidor MCP sobre stdio, para que un asistente de IA como Claude Code o Cursor pueda diagnosticar un repo directamente.</>,
  toolsH: "Herramientas",
  cols: { tool: "Herramienta", input: "Entrada", returns: "Devuelve" },
  none: "ninguna",
  returns: {
    diagnose: <>Un resumen en texto y el JSON de Diagnosis, o un log SARIF 2.1.0 con <code>format: &quot;sarif&quot;</code>.</>,
    findings_reference: <>Los 18 códigos de hallazgo con su severidad, su significado y lo que <code>migrate</code> hace con cada uno.</>,
    migrate: <>Un resumen que incluye la guía, más el JSON del plan y un diff unificado. Es un dry run salvo que pases <code>write: true</code>.</>,
    ecosystem_snapshot: <>El snapshot del ecosistema: en vivo a través de Raven, salvo que indiques un fixture.</>,
  },
  remoteH: "Repositorios remotos",
  remote: <><code>diagnose</code> y <code>migrate</code> aceptan exactamente uno de <code>path</code> o <code>url</code>. <code>url</code> es una URL de git https o ssh, o <code>owner/repo</code>. <code>ref</code> es una rama o un tag y solo aplica con <code>url</code>. El repositorio se clona en modo shallow en un directorio temporal y se elimina al terminar. Consulta <L to="/docs/what-it-scans#remote-repositories">Repositorios remotos</L>.</>,
  remoteDry: <><code>migrate</code> con <code>url</code> siempre es un dry run. <code>write: true</code> devuelve un error, incluso con <code>--allow-write</code>.</>,
  configH: "Configura tu asistente",
  config: <>Para Claude Code, agrega esto a <code>.mcp.json</code>; para Cursor, a <code>.cursor/mcp.json</code>:</>,
  loginH: "Inicio de sesión",
  loginWarning: <>El servidor MCP nunca inicia un flujo OAuth. Sin credenciales de Raven guardadas, las llamadas en vivo fallan de inmediato con <code>Run &quot;kedgeway login&quot; first</code>. Ejecuta <code>kedgeway login</code> una vez en una terminal, o pasa <code>fixture</code>.</>,
  loginBody: <><code>diagnose</code>, <code>migrate</code> y <code>ecosystem_snapshot</code> leen del disco local el <code>path</code> o el <code>fixture</code> que les indiques. <code>migrate</code> con <code>write: true</code> edita archivos ahí, pero solo si iniciaste el servidor con <code>kedgeway mcp --allow-write</code>. Sin ese flag, <code>write: true</code> devuelve un error y los dry runs siguen funcionando. La herramienta está anotada como destructiva y no de solo lectura.</>,
} satisfies DocsMcpDict;
