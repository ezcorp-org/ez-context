import { z } from "zod";

// ---------------------------------------------------------------------------
// Atomic schemas
// ---------------------------------------------------------------------------

export const ConventionCategorySchema = z.enum([
  "stack",
  "naming",
  "architecture",
  "error_handling",
  "testing",
  "imports",
  "other",
]);

export const EvidenceRefSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().nullable(),
});

export const ConventionEntrySchema = z.object({
  id: z.uuid(),
  category: ConventionCategorySchema,
  pattern: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const StackInfoSchema = z.object({
  language: z.string(),
  framework: z.string().optional(),
  testRunner: z.string().optional(),
  buildTool: z.string().optional(),
  packageManager: z.string().optional(),
  nodeVersion: z.string().optional(),
});

export const ArchitectureInfoSchema = z.object({
  pattern: z.string().optional(),
  layers: z.array(z.string()),
  entryPoints: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Root registry schema
// ---------------------------------------------------------------------------

export const ConventionRegistrySchema = z.object({
  version: z.literal("1"),
  projectPath: z.string(),
  generatedAt: z.string().datetime(),
  stack: StackInfoSchema,
  conventions: z.array(ConventionEntrySchema),
  architecture: ArchitectureInfoSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types (no manual interfaces)
// ---------------------------------------------------------------------------

export type ConventionCategory = z.infer<typeof ConventionCategorySchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ConventionEntry = z.infer<typeof ConventionEntrySchema>;
export type StackInfo = z.infer<typeof StackInfoSchema>;
export type ArchitectureInfo = z.infer<typeof ArchitectureInfoSchema>;
export type ConventionRegistry = z.infer<typeof ConventionRegistrySchema>;
