# Domain Pitfalls

**Domain:** AI context file generation CLI (semantic codebase analysis)
**Researched:** 2026-02-28
**Overall confidence:** HIGH (multiple verified sources across all categories)

---

## Critical Pitfalls

Mistakes that cause rewrites, OOM crashes, or fundamental product failure.

### CP-1: Generated Context Files That Make Agents Worse

**What goes wrong:** The tool generates comprehensive, detailed context files that paradoxically reduce agent task success rates. Research from ETH Zurich / LogicStar.ai (ICML 2025 paper, "Evaluating AGENTS.md") found that LLM-generated context files reduce task success by ~3% while increasing inference cost by 20%+. Codebase overviews -- the most common generated section -- do not help agents find relevant files faster. The only content that measurably helps is surfacing non-standard tooling agents cannot discover on their own.

**Why it happens:** Tool builders assume more context = better results. In reality, agents follow instructions literally, performing unnecessary busywork (extra greps, extra test runs) that burns tokens without improving outcomes. Boris Cherny (Staff Engineer at Anthropic, Claude Code creator) keeps his own CLAUDE.md at 2.5K tokens. Bloated files cause agents to ignore critical rules buried in noise.

**Consequences:** The core product becomes net-negative for users. Generated files actively harm the workflows they claim to improve. Users abandon the tool or manually delete most generated content.

**Warning signs:**
- Generated files exceed 500 words / 2K tokens
- Content includes codebase overviews or architecture descriptions agents discover independently
- Content repeats what exists in README.md, package.json, or tsconfig.json
- No mechanism to measure whether generated content actually helps

**Prevention:**
- Default to minimal output: only conventions agents cannot discover from existing files
- Score each generated section against a "bloat rubric": overview (+20 bloat), README duplication (+15), generic statements (+10), architecture agents discover independently (+10)
- Focus generation on: non-standard tooling, counter-intuitive conventions, testing commands, naming patterns that deviate from defaults
- Implement a `--verbose` flag for comprehensive output, but make the default lean
- Include a quality signal: "This file is N tokens. Research suggests files over 2K tokens reduce agent effectiveness."

**Confidence:** HIGH -- backed by peer-reviewed research and Anthropic's own guidance.

**Phase relevance:** Must be addressed in the template design phase (v0.1.0 generation). Getting the default output quality wrong poisons everything downstream.

**Sources:**
- [Your CLAUDE.md Is Probably Making Your Agent Worse](https://jonroosevelt.com/blog/context-files-making-agents-worse)
- [The research is in: your AGENTS.md is probably too long](https://devcenter.upsun.com/posts/agents-md-less-is-more/)
- [CLAUDE.md Memory System - Common Mistakes](https://institute.sfeir.com/en/claude-code/claude-code-memory-system-claude-md/errors/)

---

### CP-2: Embedding Model Cold Start Kills First-Run Experience

**What goes wrong:** First-time users run `ez-context generate` on an unindexed project and wait 30-120+ seconds with no feedback while the embedding model downloads, deserializes, and JIT-compiles. Transformers.js cold start breaks down into: ONNX file loading (1-3s cached, 8-12s uncached), model deserialization (1-3s), warm-up inference (variable). On top of that, ez-search indexing itself takes ~30s (GPU) to ~2min (CPU) for 1K files.

**Why it happens:** Embedding models are heavyweight assets (23-100+ MB ONNX files). WASM JIT compilation adds overhead on first inference. Session loading is sequential -- Transformers.js does not support simultaneous session loading.

**Consequences:** Users assume the tool is broken or too slow. First impressions are ruined. Competing tools that use simpler heuristics (Drift v2 uses tree-sitter AST, no embeddings) feel instant by comparison.

**Warning signs:**
- No progress indicator during model loading
- First run takes >10x longer than subsequent runs
- No explanation of what is happening during the wait
- User Ctrl+C before indexing completes, leaving corrupt partial index

**Prevention:**
- Display clear progress: "Downloading embedding model (23MB)... Indexing 847 files... Extracting conventions..."
- Auto-trigger ez-search indexing transparently but with visible progress
- Implement graceful interruption -- partial index should be resumable, not corrupt
- Run static extractors immediately (they are instant) and show partial results while semantic extraction continues
- Cache aggressively: model cache, index cache, convention registry cache
- Document expected times: "First run: ~30s (GPU) / ~2min (CPU). Subsequent runs: <5s."
- Consider a `--fast` mode that skips semantic extraction entirely (static-only) for impatient users

**Confidence:** HIGH -- cold start characteristics verified from Transformers.js documentation and Sitepoint optimization guide.

**Phase relevance:** Must be addressed in the CLI phase. The progress/UX layer cannot be an afterthought.

**Sources:**
- [Optimizing Transformers.js for Production Web Apps](https://www.sitepoint.com/optimizing-transformers-js-production/)
- [Transformers.js v3: WebGPU Support](https://huggingface.co/blog/transformersjs-v3)

---

### CP-3: Drift v1's Lesson -- TypeScript OOM on Real Codebases

**What goes wrong:** Codebase analysis tools written in TypeScript/Node.js crash with out-of-memory errors on real-world codebases. Drift (dadbodgeoff/drift) experienced this firsthand: their v1 TypeScript implementation crashed with OOM errors on large projects, forcing a complete rewrite of the analysis engine in Rust for v2. Their README states: "A complete engine rewrite in Rust allows Drift to process real-world codebases that previously crashed with OOM errors."

**Why it happens:** Loading all file contents, AST nodes, or embedding vectors into memory simultaneously. Node.js default heap is ~1.7GB. For a 1K+ file codebase, holding all chunk embeddings (768-dim float32 vectors) plus file contents plus convention metadata can exceed this. V8 garbage collection under memory pressure causes long pauses.

**Consequences:** Tool unusable on the codebases that need it most (large, complex projects). Users see cryptic "JavaScript heap out of memory" errors.

**Warning signs:**
- Memory usage grows linearly with codebase size
- No streaming or batching in the extraction pipeline
- Loading entire ez-search index into memory at once
- Testing only on small (<100 file) projects

**Prevention:**
- Query ez-search index incrementally -- never load all vectors into memory at once
- Stream file processing: process files in batches of 50-100, release references between batches
- Set explicit `--max-old-space-size` recommendation in docs (e.g., 4096 for large projects)
- Implement memory budget: track approximate memory usage, flush caches when approaching limit
- Test with 1K, 5K, and 10K file codebases during development (not just toy projects)
- Use Node.js `process.memoryUsage()` to log high-water marks during extraction

**Confidence:** HIGH -- Drift's v1 to v2 rewrite is direct evidence from a near-identical tool.

**Phase relevance:** Must be considered from the extractor pipeline phase onward. Retrofitting streaming into a load-everything architecture is painful.

**Sources:**
- [Drift GitHub - README](https://github.com/dadbodgeoff/drift)
- [Tracking down high memory usage in Node.js](https://dev.to/gkampitakis/tracking-down-high-memory-usage-in-nodejs-2lbn)

---

### CP-4: Marker-Based Updates Corrupt User Content

**What goes wrong:** The `<!-- ez-context:start -->` / `<!-- ez-context:end -->` marker system fails in edge cases, causing loss of manually written content. Failure modes include: markers deleted by user or formatter, nested markers, markers split across lines by word-wrapping, partial marker matches, and encoding changes that make markers unrecognizable.

**Why it happens:** HTML comment markers are fragile in Markdown files. Prettier or other formatters may reformat them. Users may accidentally edit within marker boundaries not realizing the section is auto-managed. Copy-paste between files can duplicate markers, creating ambiguous boundaries. Git merge conflicts can split markers.

**Consequences:** Users lose hand-crafted context file content. Trust in the tool evaporates permanently after a single data loss event. This is the single highest-consequence failure mode -- context files represent significant user investment.

**Warning signs:**
- No validation of marker integrity before writing
- No backup of previous file version before update
- Markers that can be confused with user content
- No test coverage for merge conflict scenarios, encoding changes, or formatter interference

**Prevention:**
- Before any write, validate marker pairs: every start has exactly one matching end, proper nesting, no orphans
- Create `.ez-context-backup/` with timestamped copies before any update operation
- Use unique, unlikely-to-collide markers: `<!-- ez-context:auto:section-id:v1 -->` with version and section ID
- Never write if marker validation fails -- abort with clear error message
- After writing, re-read the file and validate markers again (write-verify cycle)
- Add `prettier-ignore` comments around markers to prevent formatter interference
- Test with: empty files, files with no markers, files with corrupted markers, files with duplicate markers, files after git merge conflicts, files with different line endings (CRLF vs LF)
- Consider a `--dry-run` flag that shows what would change without writing

**Confidence:** HIGH -- marker corruption is a well-documented pattern across code generation tools (Gemini CLI PR #4068, VS Code Copilot issue #12481).

**Phase relevance:** Incremental updates phase. The marker system must be rock-solid before shipping `update` command.

**Sources:**
- [Gemini CLI: respect manual code edits](https://github.com/google-gemini/gemini-cli/pull/4068)
- [VS Code Copilot: Context Corruption with manual edits](https://github.com/microsoft/vscode-copilot-release/issues/12481)

---

## Moderate Pitfalls

Mistakes that cause delays, bad UX, or technical debt.

### MP-1: Cosine Similarity Thresholds Are Not Universal

**What goes wrong:** A hardcoded drift detection threshold (e.g., 0.4 cosine similarity) produces false positives for some projects and false negatives for others. Research shows there is no universal "safe" cosine similarity threshold -- it varies by embedding model, domain, and task. The same threshold that works for a TypeScript web app may fail for a Rust systems project because the embedding model has different density characteristics for different languages.

**Why it happens:** Cosine similarity has known biases: it underestimates similarity for high-frequency terms (BERT frequency bias), normalization timing affects scores, and regularization in the embedding training creates artifacts. Different codebases produce different embedding distributions. A "drift detected" threshold of 0.4 may flag 50% of valid claims in one project and 0% in another.

**Consequences:** Alert fatigue (too many false alarms) or false confidence (missing real drift). Users disable drift detection entirely.

**Warning signs:**
- Same threshold used regardless of project characteristics
- No calibration step when initializing drift detection
- Threshold chosen based on a single test project
- No way for users to adjust sensitivity

**Prevention:**
- Make threshold configurable per-project via `.ez-context.json` or similar config
- Implement auto-calibration: on first `drift` run, compute similarity distribution of known-good claims against the index, set threshold at a percentile (e.g., p10 of the calibration distribution)
- Provide `drift --explain` showing the actual similarity scores so users can tune
- Default to conservative (high threshold = fewer alerts), not aggressive
- Use relative drift detection: flag claims whose similarity dropped significantly from baseline, not just claims below an absolute threshold
- Store baseline similarity scores so drift is measured as change-over-time, not absolute value

**Confidence:** HIGH -- multiple academic papers confirm threshold sensitivity.

**Phase relevance:** Drift detection phase. Must be designed from the start, not bolted on.

**Sources:**
- [Is Cosine-Similarity of Embeddings Really About Similarity?](https://arxiv.org/html/2403.05440v1)
- [Problems with Cosine as a Measure of Embedding Similarity](https://aclanthology.org/2022.acl-short.45.pdf)
- [How do you tune similarity thresholds to reduce false positives?](https://milvus.io/ai-quick-reference/how-do-you-tune-similarity-thresholds-to-reduce-false-positives)

---

### MP-2: Convention Clustering Produces Garbage Without Careful Hyperparameters

**What goes wrong:** K-means or DBSCAN clustering of code embeddings produces either one giant cluster containing everything, or hundreds of micro-clusters with no meaningful convention signal. The tool reports "conventions" that are noise: "47 files use import statements" (trivially true) or clusters a single unusual file as a "convention."

**Why it happens:** K-means requires knowing the number of clusters beforehand (rarely known for conventions). DBSCAN suffers from "chaining" on embeddings -- transitive connectivity connects unrelated items through intermediaries, producing large heterogeneous clusters. Embedding dimensionality (768-dim) makes distance metrics less discriminating (curse of dimensionality). Hyperparameters (eps, min_samples for DBSCAN; k for k-means) must be tuned per-project.

**Consequences:** Generated context files contain meaningless or trivially true conventions. Users lose trust in the semantic extraction. The product's core differentiator (semantic convention detection) is undermined.

**Warning signs:**
- Clusters with >50% of files (too broad) or <3 files (too narrow)
- Conventions that state the obvious ("uses TypeScript", "has imports")
- No silhouette score or cluster quality metric computed
- Same hyperparameters used for all projects regardless of size
- No human-readable label for clusters

**Prevention:**
- Use HDBSCAN instead of DBSCAN -- it adapts to varying density without a fixed eps parameter, only needs min_samples
- Filter trivial patterns: remove conventions with >90% file coverage (they are language features, not conventions)
- Set minimum evidence threshold: a convention needs N+ files (e.g., 5+) to be reported
- Compute silhouette scores; discard clusters below quality threshold
- Implement a confidence score per convention based on cluster tightness (intra-cluster similarity)
- Combine semantic clustering with static extraction: use clusters to identify candidates, validate with AST/regex evidence
- Test clustering output manually on 5+ diverse codebases before shipping

**Confidence:** MEDIUM -- clustering on pretrained embeddings is known to be finicky; specific hyperparameter guidance for code embeddings is sparse.

**Phase relevance:** Semantic extractor phase. This is where the core differentiator either works or does not.

**Sources:**
- [Scikit-learn: Clustering documentation](https://scikit-learn.org/stable/modules/clustering.html)
- [An Empirical Study on Clustering Pretrained Embeddings](https://openreview.net/pdf?id=TbEzwuIs__)

---

### MP-3: Watch Mode Infinite Loops and Resource Exhaustion

**What goes wrong:** The `watch` command writes updated context files into the watched directory, triggering new change events, causing an infinite regeneration loop. Or: the watcher consumes excessive file descriptors / inotify watches on large Linux codebases, hitting OS limits (`ENOSPC` errors) and causing system-wide issues for the user.

**Why it happens:** Writing output files triggers the watcher that monitors for input changes. On Linux, `fs.watch` recursive option uses non-native inotify per-directory watchers that scale linearly with directory count. Default inotify limit is 8192 watches -- a monorepo with thousands of directories exhausts this. Chokidar can silently fall back to CPU polling, consuming significant CPU.

**Consequences:** 100% CPU usage, system resource exhaustion, or rapid infinite file rewrites that fill disk or corrupt output files.

**Warning signs:**
- Output files are in the same directory tree as watched input files
- No exclusion of output file paths from the watcher
- No loop detection (detecting same content written repeatedly)
- No `ENOSPC` error handling with helpful message
- Testing only on macOS (where FSEvents handles recursion natively)

**Prevention:**
- Explicitly ignore output file paths in the watcher (CLAUDE.md, AGENTS.md, etc.)
- Implement write-lock: skip watcher events during active write operations
- Add loop detection: if the same convention re-triggers within N seconds, suppress
- Debounce aggressively: 2-5 seconds for watch mode (not 100-200ms)
- Catch `ENOSPC` and print: "Too many files to watch. Increase inotify limit: `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf`"
- Use evidence-based watching: only watch files that are evidence for detected conventions, not the entire tree
- Set `depth` limits on recursive watching
- Test on Linux specifically -- macOS FSEvents masks many issues

**Confidence:** HIGH -- verified from chokidar issues, Node.js fs.watch documentation, and multiple production incident reports.

**Phase relevance:** Watch mode phase (v0.2.0). Can be deferred but must be addressed before shipping watch.

**Sources:**
- [Chokidar GitHub - Issue #677 (resource leaks)](https://github.com/paulmillr/chokidar/issues/677)
- [Chokidar GitHub - Issue #859 (Node.js hangs)](https://github.com/paulmillr/chokidar/issues/859)
- [Node.js fs.watch recursive on Linux - Issue #36005](https://github.com/nodejs/node/issues/36005)

---

### MP-4: Claim Extraction from Free-Text Is Fragile

**What goes wrong:** The drift detection claim extractor fails to parse claims from hand-written or unusually formatted context files. Natural language claims like "We generally prefer composition over inheritance" cannot be cleanly extracted as a single testable proposition. Multi-sentence paragraphs, nested lists, conditional statements ("Use X except when Y"), and non-English content break naive splitting.

**Why it happens:** Context files are free-form Markdown with no enforced structure. Different users write in different styles: some use bullet points, some use prose, some use code blocks. A sentence-level splitter cannot distinguish testable claims from commentary, caveats, or meta-instructions ("See also: ...").

**Consequences:** Drift detection misses real drift (claims not extracted) or produces false alerts (commentary treated as claims). The core differentiator is unreliable.

**Warning signs:**
- Claim extraction tested only on tool-generated context files (easy mode)
- No handling of multi-clause sentences
- No filtering of non-claim content (TODOs, links, headers)
- No test suite of hand-written context files in diverse styles

**Prevention:**
- Start with ez-context's own generated files (structured, predictable) -- these are the easy case
- For hand-written files, use heuristic filters: skip headers, links, metadata, code blocks, and sentences with question marks
- Each claim should map to a convention type (framework, test runner, naming, etc.) -- unmappable sentences are likely not claims
- Implement `drift --inspect` to show extracted claims before scoring, so users can see what the tool "thinks" the file says
- Provide a structured alternative: optional YAML frontmatter in context files that lists claims explicitly
- Collect a test corpus of 20+ real-world CLAUDE.md files to validate extraction

**Confidence:** MEDIUM -- architectural risk acknowledged in ARCHITECTURE.md risk assessment; no verified approach for robust free-text claim extraction.

**Phase relevance:** Drift detection phase. Design the claim extraction carefully before building the comparison engine.

---

### MP-5: Cross-Platform Line Ending and Encoding Issues

**What goes wrong:** Context files written on one OS have different line endings (CRLF on Windows, LF on Unix). Markers split across CRLF boundaries are not recognized on subsequent reads. Files with BOM (Byte Order Mark) prepended by Windows editors cause marker matching to fail at the start of file. Non-UTF8 encoded files (common in legacy codebases) corrupt when read as UTF8.

**Why it happens:** Node.js `fs.readFile` with `utf8` encoding does not normalize line endings or handle BOM. Template engines may output platform-native line endings. Git `core.autocrlf` can silently change line endings between commits.

**Consequences:** Markers not recognized, manual content overwritten, or file encoding corruption. Particularly insidious because it works fine on the developer's machine and fails on CI or other platforms.

**Warning signs:**
- No explicit line ending normalization in file read/write
- Marker matching uses literal string comparison without whitespace normalization
- No BOM handling
- Tests run only on one OS

**Prevention:**
- Normalize line endings on read (convert CRLF to LF internally)
- Write files with LF line endings consistently (Markdown standard)
- Strip BOM on read, do not add BOM on write
- Use `.gitattributes` guidance in docs: `*.md text eol=lf`
- Marker matching should be whitespace-tolerant: trim lines before comparing
- Test on Windows (or at minimum, test with CRLF input files)

**Confidence:** MEDIUM -- well-known cross-platform issue, but specific incidence in this tool type not empirically verified.

**Phase relevance:** Template engine and marker system design.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

### mP-1: Drift Tool File Discovery Failures

**What goes wrong:** The codebase scanner misses files in non-standard project structures. Drift's open issue #56 documents exactly this: running on C++ projects in subfolders with Qt5 .pro files reports "Found 0 source files." This happens because file discovery assumes a conventional project layout.

**Why it happens:** Hardcoded assumptions about project structure: expects `src/`, `lib/`, `test/` directories. Gitignore-based exclusions may accidentally exclude relevant files. Monorepo structures with nested project roots confuse the scanner.

**Prevention:**
- Rely on ez-search's file discovery (which uses gitignore rules) rather than building a custom scanner
- Test with: monorepos, non-standard layouts, nested projects, symlinks
- Provide `--include` and `--exclude` overrides for edge cases
- Log which files were discovered and allow `inspect --files` to verify

**Confidence:** HIGH -- documented issue in Drift.

**Phase relevance:** File discovery is inherited from ez-search, but should be validated early.

**Source:** [Drift Issue #56](https://github.com/dadbodgeoff/drift/issues/56)

---

### mP-2: AGENTS.md Specification Ambiguity

**What goes wrong:** AGENTS.md v1.0 has undocumented behaviors around file discovery, layering, and precedence. Tools that generate AGENTS.md files may produce content that works with one agent (e.g., OpenAI Codex) but is ignored or misinterpreted by another (e.g., Cursor, Claude Code). A v1.1 proposal (Issue #135 on agentsmd/agents.md) attempts to formalize these implicit conventions.

**Why it happens:** The spec was designed to be "deliberately lightweight" -- great for adoption, bad for interoperability. Different agents implement different interpretations of hierarchy, scope, and precedence.

**Prevention:**
- Track AGENTS.md spec changes actively (it is evolving rapidly in 2026)
- Generate files that work with the lowest-common-denominator interpretation
- Do not rely on hierarchical AGENTS.md behavior that is not explicitly specified
- Test generated AGENTS.md files with multiple agents (Claude Code, Codex, Cursor)
- Document which AGENTS.md features are v1.0 spec vs. implementation-specific

**Confidence:** HIGH -- spec limitations documented in official GitHub issues.

**Phase relevance:** AGENTS.md generation (v0.1.0).

**Source:** [AGENTS.md v1.1 Proposal - Issue #135](https://github.com/agentsmd/agents.md/issues/135)

---

### mP-3: Stale Convention Registry After Codebase Refactors

**What goes wrong:** After a major refactor (e.g., migrating from Express to Hono), the cached convention registry retains outdated conventions until a full re-scan is triggered. Incremental updates based on mtime+hash may miss semantic changes that span many files (e.g., a framework migration touches 50 files, but only 10 have changed mtimes because the rest were batch-renamed).

**Why it happens:** Incremental change detection optimizes for single-file changes, not bulk refactors. The manifest tracks individual files, not semantic relationships between them.

**Prevention:**
- Provide `ez-context generate --force` to trigger full re-extraction
- Detect bulk changes: if >20% of evidence files changed, force full re-extraction automatically
- After `generate`, always run a lightweight drift check to verify the registry is internally consistent
- Timestamp the convention registry and display age in output: "Conventions extracted 3 days ago. Run --force to refresh."

**Confidence:** MEDIUM -- logical inference from incremental update architecture.

**Phase relevance:** Incremental updates phase.

---

### mP-4: Template Output Format Drift Across Agent Versions

**What goes wrong:** AI agents update their context file format expectations (e.g., Cursor .mdc frontmatter schema changes, SKILL.md specification evolves). Hardcoded templates produce output that becomes stale relative to current agent expectations.

**Prevention:**
- Separate templates from core logic (already planned with template engine)
- Version templates independently from the CLI
- Provide `ez-context update-templates` to fetch latest templates without upgrading the whole CLI
- Monitor agent documentation for format changes (especially Cursor, which changes frequently)

**Confidence:** LOW -- speculative based on rapid pace of format evolution in 2025-2026.

**Phase relevance:** Multi-format output (v0.2.0).

---

## Phase-Specific Warnings Summary

| Phase | Likely Pitfall | Severity | Mitigation |
|-------|---------------|----------|------------|
| Convention Extraction | CP-3 (OOM), MP-2 (clustering garbage) | Critical/Moderate | Stream processing, HDBSCAN, quality metrics |
| Template Design | CP-1 (files that hurt agents) | Critical | Minimal default output, bloat scoring |
| CLI/UX | CP-2 (cold start) | Critical | Progress bars, static-first results, --fast mode |
| Marker System | CP-4 (content corruption) | Critical | Validation, backups, write-verify cycle |
| Drift Detection | MP-1 (threshold tuning), MP-4 (claim extraction) | Moderate | Auto-calibration, relative drift, --inspect |
| Watch Mode | MP-3 (infinite loops, resource exhaustion) | Moderate | Output exclusion, write-lock, evidence-based watching |
| Multi-Format Output | mP-2 (AGENTS.md ambiguity), mP-4 (format drift) | Minor | Spec tracking, template versioning |
| Incremental Updates | mP-3 (stale registry) | Minor | Bulk change detection, --force flag |

---

## Lessons from Comparable Tools

### Drift (dadbodgeoff/drift)
- **v1 to v2 rewrite:** TypeScript OOM crashes on real codebases forced a Rust rewrite of the analysis engine. Lesson: stream and batch from day one, do not load everything into memory.
- **File discovery bugs:** Issue #56 shows C++/Qt5 projects reporting zero files found. Lesson: test with diverse project structures, not just standard web app layouts.
- **Progressive disclosure failure:** Issue #61 shows workflow breaking at final step. Lesson: test the entire user journey end-to-end, not just individual commands.

### Context-Forge (webdevtodayjason/context-forge)
- **Missing CLI flags:** Issue #9 (`--prd not available`). Lesson: ensure all documented flags are implemented and tested. CLI tools with broken flags lose trust fast.

### ClaudeForge
- **Bloated output problem:** Addresses the common pattern of 600-line CLAUDE.md files that Claude struggles to parse. Lesson: output size is a feature, not a limitation. Less is more.

### Agent-Guard / Doc Drift Tools
- **Stale documentation as the core problem:** AI agents coding against fictional documentation. Lesson: drift detection is a real need -- but the detection must be accurate enough to be trusted, otherwise it becomes another source of noise.

### ETH Zurich / LogicStar.ai Research (2026)
- **Context overviews are useless for agents.** 100% of generated context files include codebase overviews; they provide zero measurable benefit. Lesson: challenge every section type with "does this actually help the agent?"

---

## Open Questions (Need Phase-Specific Research)

1. **HDBSCAN in JavaScript/TypeScript:** Is there a production-quality HDBSCAN implementation for Node.js, or does this need to call into Python/Rust? This affects the semantic extractor architecture.
2. **Claim extraction approaches:** What NLP techniques work best for extracting testable claims from Markdown? Sentence splitting + heuristic filtering vs. lightweight NER? Needs prototyping.
3. **Embedding model choice for claims vs. code:** nomic-embed-text for claims, jina-embeddings-v2-base-code for code -- do cross-model similarity comparisons produce meaningful results, or do both claim and code need the same model?
4. **Optimal convention granularity:** How specific should extracted conventions be? "Uses TypeScript" (too broad) vs. "Uses branded types for domain IDs in service layer" (too narrow). Needs user testing.
