import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- factories use only vi.fn() to avoid hoisting issues
// ---------------------------------------------------------------------------

vi.mock("../../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn(),
}));

vi.mock("../../../src/utils/fs.js", () => ({
  listProjectFiles: vi.fn(),
}));

// Import AFTER mock setup
import { architectureExtractor } from "../../../src/extractors/semantic/architecture.js";
import { createBridge } from "../../../src/core/ez-search-bridge.js";
import { listProjectFiles } from "../../../src/utils/fs.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBridge(overrides: {
  hasIndex?: boolean;
  searchResults?: { file: string; chunk: string; score: number }[];
}) {
  const { hasIndex = false, searchResults = [] } = overrides;
  return {
    hasIndex: vi.fn().mockResolvedValue(hasIndex),
    search: vi.fn().mockResolvedValue(searchResults),
    ensureIndex: vi.fn(),
    embed: vi.fn(),
  };
}

function makeFiles(files: string[]): string[] {
  return files;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("architectureExtractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects MVC from directory structure (models/, views/, controllers/)", async () => {
    const bridge = makeBridge({ hasIndex: false });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/models/user.ts",
        "src/models/post.ts",
        "src/views/home.tsx",
        "src/controllers/user-controller.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe("architecture");
    expect(entries[0]!.pattern).toBe("MVC architecture pattern");
    expect(entries[0]!.metadata?.architecturePattern).toBe("MVC");
    expect(entries[0]!.metadata?.layers).toEqual(expect.arrayContaining(["src/models"]));
  });

  it("detects feature-based from directories with features/moduleA/, features/moduleB/", async () => {
    const bridge = makeBridge({ hasIndex: false });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/features/auth/login.ts",
        "src/features/auth/logout.ts",
        "src/features/users/profile.ts",
        "src/features/users/settings.ts",
        "src/features/dashboard/index.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.pattern).toBe("Feature-based architecture");
    expect(entries[0]!.metadata?.architecturePattern).toBe("feature-based");
  });

  it("detects layer-based from directories (domain/, application/, infrastructure/)", async () => {
    const bridge = makeBridge({ hasIndex: false });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/domain/user.ts",
        "src/domain/order.ts",
        "src/application/user-service.ts",
        "src/infrastructure/db.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.pattern).toBe("Layer-based architecture");
    expect(entries[0]!.metadata?.architecturePattern).toBe("layer-based");
    expect(entries[0]!.metadata?.layers).toEqual(
      expect.arrayContaining(["src/domain", "src/application", "src/infrastructure"])
    );
  });

  it("returns [] when no architecture pattern matches", async () => {
    const bridge = makeBridge({ hasIndex: false });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/utils/helpers.ts",
        "src/config/env.ts",
        "src/types/index.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toEqual([]);
  });

  it("works without index (directory-only mode returns confidence 0.7)", async () => {
    const bridge = makeBridge({ hasIndex: false });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/models/user.ts",
        "src/views/home.tsx",
        "src/controllers/main.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.confidence).toBe(0.7);
    expect(bridge.search).not.toHaveBeenCalled();
  });

  it("confidence increases to 0.85 when search confirms pattern", async () => {
    const bridge = makeBridge({
      hasIndex: true,
      searchResults: [
        { file: "src/models/user.ts", chunk: "class User extends Model", score: 0.9 },
        { file: "src/controllers/user-controller.ts", chunk: "class UserController", score: 0.85 },
      ],
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/models/user.ts",
        "src/views/home.tsx",
        "src/controllers/main.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.confidence).toBe(0.85);
    expect(bridge.search).toHaveBeenCalled();
  });

  it("metadata.layers populated with detected directory names", async () => {
    const bridge = makeBridge({ hasIndex: false });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/domain/entity.ts",
        "src/application/service.ts",
        "src/infrastructure/repo.ts",
        "src/infrastructure/db.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toHaveLength(1);
    const layers = entries[0]!.metadata?.layers as string[];
    expect(Array.isArray(layers)).toBe(true);
    expect(layers.length).toBeGreaterThanOrEqual(2);
    expect(layers).toEqual(expect.arrayContaining(["src/domain", "src/application", "src/infrastructure"]));
  });

  it("evidence is capped at 5 items and deduplicated", async () => {
    const bridge = makeBridge({
      hasIndex: true,
      searchResults: [
        { file: "src/models/user.ts", chunk: "model", score: 0.9 },
        { file: "src/views/home.tsx", chunk: "view", score: 0.8 },
        { file: "src/controllers/ctrl.ts", chunk: "controller", score: 0.7 },
      ],
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);
    vi.mocked(listProjectFiles).mockResolvedValue(
      makeFiles([
        "src/models/user.ts",
        "src/models/post.ts",
        "src/views/home.tsx",
        "src/controllers/ctrl.ts",
        "src/routes/api.ts",
      ])
    );

    const entries = await architectureExtractor.extract({ projectPath: "/project" });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.evidence.length).toBeLessThanOrEqual(5);
    // All evidence entries should have unique file paths
    const files = entries[0]!.evidence.map((e) => e.file);
    expect(new Set(files).size).toBe(files.length);
  });
});
