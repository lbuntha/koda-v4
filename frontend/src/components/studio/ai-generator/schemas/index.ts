/**
 * Schemas barrel export
 */
export type { ComponentSchema, SchemaField, SchemaAsset } from "./types";
export { countSchema } from "./count.schema";
export { additionTutorSchema } from "./additionTutor.schema";
export {
  SCHEMA_REGISTRY,
  getSchemaByTechnique,
  getSupportedTechniques,
  detectTechniqueFromPrompt,
  buildSystemPrompt,
  auditRegistry
} from "./registry";
export type { RegistryIssue } from "./registry";

// Dev-only self-check: surfaces schema problems (duplicate techniques, keyword
// collisions, a validate() that throws on empty input) the moment the app
// loads, instead of waiting for someone to hit them in the generator UI.
// Cast: this project has no vite/client type reference set up, so
// import.meta.env isn't typed. Vite still replaces it correctly at build time.
if ((import.meta as any).env?.DEV) {
  import("./registry").then(({ auditRegistry }) => {
    const issues = auditRegistry();
    if (issues.length > 0) {
      // eslint-disable-next-line no-console
      console.groupCollapsed(`%c[ai-generator] registry audit: ${issues.length} issue(s)`, "color: #f59e0b");
      for (const issue of issues) {
        const log = issue.severity === "error" ? console.error : console.warn;
        log(`[${issue.schema}] ${issue.message}`);
      }
      console.groupEnd();
    }
  });
}
