// ez-context - AI context file generator with semantic drift detection
// Public API barrel exports

export * from "./core/schema.js";
export * from "./core/registry.js";
export { extractConventions } from "./core/pipeline.js";
export {
  createBridge,
  type EzSearchBridge,
  type SearchResult,
} from "./core/ez-search-bridge.js";
export {
  listProjectFiles,
  ALWAYS_SKIP,
  type ListFilesOptions,
} from "./utils/fs.js";
export type {
  Extractor,
  ExtractionContext,
  ExtractorOptions,
} from "./extractors/types.js";
export { runExtractors } from "./extractors/index.js";
export {
  emit,
  renderClaudeMd,
  renderAgentsMd,
  renderCursorMdc,
  renderCopilotMd,
  renderSkillMd,
  renderRulesyncMd,
  renderRulerMd,
} from "./emitters/index.js";
export type { EmitOptions, EmitResult, OutputFormat } from "./emitters/types.js";
export { writeWithMarkers, MARKER_START, MARKER_END } from "./emitters/writer.js";
