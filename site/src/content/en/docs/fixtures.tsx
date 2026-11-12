import type { DocsFixturesDict } from "../../schema/docs-fixtures";

export default {
  meta: { title: "Fixtures — kedgeway docs", description: "The ecosystem snapshot JSON format used by --fixture, with a complete example." },
  h1: "Fixtures",
  lede: <>A fixture is a saved ecosystem snapshot. Pass it with <code>--fixture</code> to run without Raven: for tests, offline machines and CI.</>,
  shapeH: "Shape",
  cols: { field: "Field", type: "Type", notes: "Notes" },
  fields: {
    observedAt: { type: "string", notes: <>Required. When the snapshot was taken, ISO 8601.</> },
    currentMajor: { type: "integer or null", notes: <>Required. Null makes soroban-sdk findings SDK_UNKNOWN.</> },
    deprecatedVersions: { type: "string[]", notes: <>Required. Versions listed as deprecated. Only their majors are compared.</> },
    sorobanSource: { type: "string", notes: <>Required. Shown as the source in findings.</> },
    currentVersion: { type: "string or null", notes: <>Required. Null makes JavaScript findings JS_SDK_UNKNOWN.</> },
    jsSource: { type: "string", notes: <>Required.</> },
    protocolCurrent: { type: "number or null", notes: <>Optional. Defaults to null.</> },
    notes: { type: "array", notes: <>Required, may be empty. Items have <code>title</code>, <code>url</code> and <code>snippet</code> (all strings).</> },
    degraded: { type: "string[]", notes: <>Optional. Defaults to empty. Each entry becomes a DATA_DEGRADED finding.</> },
  },
  exampleH: "Complete example",
  after: <>A file that does not match this shape makes the run exit with 1 and a message. Fixtures are not refreshed automatically: the ecosystem moves, your fixture does not.</>,
} satisfies DocsFixturesDict;
