<script lang="ts">
  import { inview } from '$lib/utils/inview';
  import Footer from '$lib/components/Footer.svelte';

  let s1 = $state(false);
  let s2 = $state(false);
  let s3 = $state(false);
  let s4 = $state(false);
  let s5 = $state(false);
  let s6 = $state(false);
  let s7 = $state(false);
  let s8 = $state(false);

  const formats = [
    { flag: 'claude',    name: 'CLAUDE.md',                        path: 'CLAUDE.md',                        desc: 'Anthropic Claude Code context file. Used by claude-code and MCP-compatible tools.' },
    { flag: 'agents',   name: 'AGENTS.md',                        path: 'AGENTS.md',                        desc: 'Linux Foundation agent standard. Cross-platform context for any agent runtime.' },
    { flag: 'cursor',   name: 'Cursor Rules',                     path: '.cursor/rules/*.mdc',               desc: 'Cursor IDE rules in MDC format with glob-scoped context per rule.' },
    { flag: 'copilot',  name: 'Copilot',                          path: '.github/copilot-instructions.md',  desc: 'GitHub Copilot workspace instructions. Injected into every Copilot interaction.' },
    { flag: 'skills',   name: 'SKILL.md',                         path: 'SKILL.md',                         desc: 'Skill modules with progressive disclosure. Structured for agent skill registries.' },
    { flag: 'rulesync', name: 'Rulesync',                         path: '.rulesync/rules/ez-context.md',    desc: 'Rulesync format for cross-editor rule synchronization and sharing.' },
    { flag: 'ruler',    name: 'Ruler',                            path: '.ruler/*.md',                      desc: 'Ruler format for opinionated context organization with tagging support.' },
  ];
</script>

<svelte:head>
  <title>Documentation | ez-context</title>
  <meta name="description" content="Complete reference for ez-context: installation, CLI commands, output formats, drift detection, and marker syntax." />
  <link rel="canonical" href="https://ez-context.ezcorp.org/docs" />
</svelte:head>

<!-- Skip to main content -->
<a
  href="#main"
  class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-ez-yellow focus:px-4 focus:py-2 focus:text-ez-dark focus:font-semibold focus:outline-none"
>
  Skip to main content
</a>

<main id="main" class="min-h-screen bg-ez-dark">

  <!-- Page header -->
  <header class="border-b border-ez-border-dark px-6 md:px-8 py-6">
    <div class="max-w-3xl mx-auto flex items-center justify-between">
      <a href="/" class="flex items-center gap-3 group">
        <img src="/logo.svg" alt="ez-context" class="h-8 w-auto" />
        <span class="text-ez-light/50 group-hover:text-ez-light transition-colors duration-150 text-sm">
          &larr; Back to home
        </span>
      </a>
      <span class="text-xs font-mono text-ez-light/30 border border-ez-border-dark rounded px-2 py-1">
        v0.1.14
      </span>
    </div>
  </header>

  <div class="px-6 md:px-8">
    <div class="max-w-3xl mx-auto">

      <!-- Title -->
      <div class="py-12 md:py-16 border-b border-ez-border-dark">
        <h1 class="text-4xl md:text-5xl font-bold text-ez-light mb-4">
          ez-context Documentation
        </h1>
        <p class="text-lg text-ez-light/60">
          Everything you need to generate, inspect, and maintain AI context files that stay in sync with your codebase.
        </p>

        <!-- Quick jump links -->
        <nav class="mt-8 flex flex-wrap gap-2" aria-label="Page sections">
          {#each [
            ['#what-is-ez-context', 'What is it?'],
            ['#installation', 'Installation'],
            ['#quick-start', 'Quick Start'],
            ['#cli-commands', 'CLI Commands'],
            ['#output-formats', 'Output Formats'],
            ['#drift-detection', 'Drift Detection'],
            ['#markers', 'Markers'],
          ] as [href, label]}
            <a
              {href}
              class="inline-block text-xs font-mono border border-ez-border-dark rounded px-3 py-1.5 text-ez-light/50 hover:text-ez-yellow hover:border-ez-yellow/30 transition-colors duration-150"
            >
              {label}
            </a>
          {/each}
        </nav>
      </div>

      <!-- ── Section 1: What is ez-context? ── -->
      <section
        id="what-is-ez-context"
        class="py-12 md:py-16 border-b border-ez-border-dark"
        use:inview
        oninview={() => (s1 = true)}
      >
        <div class="transition-all duration-700 {s1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="scroll-mt-24 text-2xl md:text-3xl font-bold text-ez-light mb-6">
            What is ez-context?
          </h2>
          <div class="space-y-4 text-ez-light/70 leading-relaxed">
            <p>
              ez-context analyzes your codebase to extract real coding conventions -- naming patterns, import styles, test setup, error handling, stack configuration -- and generates AI context files that accurately reflect how your project works.
            </p>
            <p>
              Context files like <code class="bg-black/30 border border-ez-border-dark rounded px-1.5 py-0.5 font-mono text-sm text-ez-yellow">CLAUDE.md</code> and <code class="bg-black/30 border border-ez-border-dark rounded px-1.5 py-0.5 font-mono text-sm text-ez-yellow">AGENTS.md</code> are written once and then forgotten. As your codebase evolves, these files drift -- they describe conventions you abandoned months ago, reference patterns you never actually use, and silently mislead the AI tools that depend on them.
            </p>
            <p>
              ez-context solves this by detecting <strong class="text-ez-light font-semibold">semantic drift</strong>: it compares each claim in your context files against actual evidence in your code, scores every claim as confirmed or contradicted, and can automatically rewrite stale sections while preserving your manual edits.
            </p>
            <p>
              It supports <strong class="text-ez-light font-semibold">7 output formats</strong> -- from Claude Code to Cursor rules to GitHub Copilot instructions -- so one tool covers every AI assistant in your workflow.
            </p>
          </div>
        </div>
      </section>

      <!-- ── Section 2: Installation ── -->
      <section
        id="installation"
        class="py-12 md:py-16 border-b border-ez-border-dark"
        use:inview
        oninview={() => (s2 = true)}
      >
        <div class="transition-all duration-700 {s2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="scroll-mt-24 text-2xl md:text-3xl font-bold text-ez-light mb-6">
            Installation
          </h2>
          <p class="text-ez-light/70 mb-6">
            Install ez-context globally using your preferred package manager. Requires Node.js &ge; 20.19.0.
          </p>

          <div class="space-y-3">
            {#each [
              ['npm',  'npm install -g @ez-corp/ez-context'],
              ['pnpm', 'pnpm add -g @ez-corp/ez-context'],
              ['bun',  'bun add -g @ez-corp/ez-context'],
              ['yarn', 'yarn global add @ez-corp/ez-context'],
            ] as [pm, cmd]}
              <div class="flex items-center gap-3">
                <span class="w-10 text-xs font-mono text-ez-light/30 shrink-0">{pm}</span>
                <pre class="flex-1 bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto">{cmd}</pre>
              </div>
            {/each}
          </div>

          <p class="mt-6 text-sm text-ez-light/50">
            After install, run <code class="bg-black/30 border border-ez-border-dark rounded px-1.5 py-0.5 font-mono text-xs text-ez-yellow">ez-context --version</code> to confirm.
          </p>
        </div>
      </section>

      <!-- ── Section 3: Quick Start ── -->
      <section
        id="quick-start"
        class="py-12 md:py-16 border-b border-ez-border-dark"
        use:inview
        oninview={() => (s3 = true)}
      >
        <div class="transition-all duration-700 {s3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="scroll-mt-24 text-2xl md:text-3xl font-bold text-ez-light mb-6">
            Quick Start
          </h2>
          <p class="text-ez-light/70 mb-8">
            Three commands cover the complete workflow. Run them from your project root.
          </p>

          <ol class="space-y-8">
            <li class="flex gap-5">
              <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ez-border-dark font-mono text-sm font-bold text-ez-yellow">1</span>
              <div class="flex-1 space-y-2">
                <p class="font-semibold text-ez-light">Analyze and generate context files</p>
                <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto">ez-context generate</pre>
                <p class="text-sm text-ez-light/50">Scans your project and writes <code class="font-mono text-ez-yellow text-xs">CLAUDE.md</code> and <code class="font-mono text-ez-yellow text-xs">AGENTS.md</code> by default.</p>
              </div>
            </li>
            <li class="flex gap-5">
              <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ez-border-dark font-mono text-sm font-bold text-ez-yellow">2</span>
              <div class="flex-1 space-y-2">
                <p class="font-semibold text-ez-light">Check for drift</p>
                <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto">ez-context drift</pre>
                <p class="text-sm text-ez-light/50">Compares your context files against the codebase. Reports a health score and lists outdated claims.</p>
              </div>
            </li>
            <li class="flex gap-5">
              <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ez-border-dark font-mono text-sm font-bold text-ez-yellow">3</span>
              <div class="flex-1 space-y-2">
                <p class="font-semibold text-ez-light">Fix stale sections</p>
                <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto">ez-context update</pre>
                <p class="text-sm text-ez-light/50">Rewrites the ez-context-managed block in each file. Manual content outside the markers is untouched.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <!-- ── Section 4: CLI Commands ── -->
      <section
        id="cli-commands"
        class="py-12 md:py-16 border-b border-ez-border-dark"
        use:inview
        oninview={() => (s4 = true)}
      >
        <div class="transition-all duration-700 {s4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="scroll-mt-24 text-2xl md:text-3xl font-bold text-ez-light mb-10">
            CLI Commands
          </h2>

          <div class="space-y-14">

            <!-- generate -->
            <div>
              <h3 class="scroll-mt-24 text-xl font-semibold text-ez-light mb-1">generate</h3>
              <p class="text-ez-light/60 text-sm mb-3">Extract conventions and generate context files.</p>
              <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto mb-4">ez-context generate [path]</pre>
              <dl class="space-y-3">
                {#each [
                  ['--dry-run',            null,          'Preview output without writing any files'],
                  ['-y, --yes',            null,          'Non-interactive mode (skip confirmation prompts)'],
                  ['--output &lt;dir&gt;',  '.',           'Directory to write generated files into'],
                  ['--threshold &lt;n&gt;', '0.7',         'Confidence threshold 0&ndash;1 for including a convention'],
                  ['--format &lt;formats&gt;', 'claude,agents', 'Comma-separated list of output formats to generate'],
                ] as [flag, def, desc]}
                  <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-2 border-b border-ez-border-dark/50 last:border-0">
                    <dt class="shrink-0 font-mono text-sm text-ez-yellow sm:w-52">{@html flag}</dt>
                    <dd class="flex-1 text-sm text-ez-light/60">
                      {@html desc}
                      {#if def}<span class="ml-2 font-mono text-xs text-ez-light/30">(default: {def})</span>{/if}
                    </dd>
                  </div>
                {/each}
              </dl>
              <div class="mt-4 text-sm text-ez-light/50">
                Valid format values: <code class="font-mono text-xs text-ez-yellow">claude</code> <code class="font-mono text-xs text-ez-yellow">agents</code> <code class="font-mono text-xs text-ez-yellow">cursor</code> <code class="font-mono text-xs text-ez-yellow">copilot</code> <code class="font-mono text-xs text-ez-yellow">skills</code> <code class="font-mono text-xs text-ez-yellow">rulesync</code> <code class="font-mono text-xs text-ez-yellow">ruler</code>
              </div>
              <div class="mt-4 space-y-2">
                <p class="text-xs text-ez-light/40 font-mono uppercase tracking-wide">Examples</p>
                <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto"># Generate all 7 formats
ez-context generate --format claude,agents,cursor,copilot,skills,rulesync,ruler

# Preview what would be written
ez-context generate --dry-run

# Analyze a subdirectory at lower confidence
ez-context generate ./packages/api --threshold 0.6 --output ./packages/api</pre>
              </div>
            </div>

            <!-- inspect -->
            <div>
              <h3 class="scroll-mt-24 text-xl font-semibold text-ez-light mb-1">inspect</h3>
              <p class="text-ez-light/60 text-sm mb-3">Display all detected conventions grouped by category with confidence scores.</p>
              <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto mb-4">ez-context inspect [path]</pre>
              <dl class="space-y-3">
                {#each [
                  ['--threshold &lt;n&gt;', '0.7', 'Minimum confidence to include a convention in output'],
                ] as [flag, def, desc]}
                  <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-2 border-b border-ez-border-dark/50 last:border-0">
                    <dt class="shrink-0 font-mono text-sm text-ez-yellow sm:w-52">{@html flag}</dt>
                    <dd class="flex-1 text-sm text-ez-light/60">
                      {@html desc}
                      {#if def}<span class="ml-2 font-mono text-xs text-ez-light/30">(default: {def})</span>{/if}
                    </dd>
                  </div>
                {/each}
              </dl>
              <div class="mt-4 text-sm text-ez-light/60">
                Use <code class="bg-black/30 border border-ez-border-dark rounded px-1.5 py-0.5 font-mono text-xs text-ez-yellow">inspect</code> to understand what ez-context detected before committing to generated files. Useful for tuning <code class="font-mono text-xs text-ez-yellow">--threshold</code>.
              </div>
            </div>

            <!-- drift -->
            <div>
              <h3 class="scroll-mt-24 text-xl font-semibold text-ez-light mb-1">drift</h3>
              <p class="text-ez-light/60 text-sm mb-3">Check context files against your codebase for semantic drift.</p>
              <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto mb-4">ez-context drift [path]</pre>
              <dl class="space-y-3">
                {#each [
                  ['--file &lt;contextFile&gt;', null, 'Check a specific file instead of all managed files'],
                ] as [flag, def, desc]}
                  <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-2 border-b border-ez-border-dark/50 last:border-0">
                    <dt class="shrink-0 font-mono text-sm text-ez-yellow sm:w-52">{@html flag}</dt>
                    <dd class="flex-1 text-sm text-ez-light/60">
                      {@html desc}
                      {#if def}<span class="ml-2 font-mono text-xs text-ez-light/30">(default: {def})</span>{/if}
                    </dd>
                  </div>
                {/each}
              </dl>
              <div class="mt-4 space-y-2">
                <p class="text-xs text-ez-light/40 font-mono uppercase tracking-wide">Examples</p>
                <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto"># Check all context files
ez-context drift

# Check a single file
ez-context drift --file CLAUDE.md

# Check a project in another directory
ez-context drift ./packages/api</pre>
              </div>
            </div>

            <!-- update -->
            <div>
              <h3 class="scroll-mt-24 text-xl font-semibold text-ez-light mb-1">update</h3>
              <p class="text-ez-light/60 text-sm mb-3">Rewrite drifted sections in context files while preserving manual edits outside the markers.</p>
              <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-3 font-mono text-sm text-ez-green overflow-x-auto mb-4">ez-context update [path]</pre>
              <dl class="space-y-3">
                {#each [
                  ['--file &lt;contextFile&gt;', null,  'Update a specific file instead of all managed files'],
                  ['--dry-run',              null,  'Preview what would change without writing files'],
                  ['-y, --yes',              null,  'Non-interactive mode (skip confirmation prompts)'],
                ] as [flag, def, desc]}
                  <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-2 border-b border-ez-border-dark/50 last:border-0">
                    <dt class="shrink-0 font-mono text-sm text-ez-yellow sm:w-52">{@html flag}</dt>
                    <dd class="flex-1 text-sm text-ez-light/60">
                      {@html desc}
                      {#if def}<span class="ml-2 font-mono text-xs text-ez-light/30">(default: {def})</span>{/if}
                    </dd>
                  </div>
                {/each}
              </dl>
            </div>

          </div>
        </div>
      </section>

      <!-- ── Section 5: Output Formats ── -->
      <section
        id="output-formats"
        class="py-12 md:py-16 border-b border-ez-border-dark"
        use:inview
        oninview={() => (s5 = true)}
      >
        <div class="transition-all duration-700 {s5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="scroll-mt-24 text-2xl md:text-3xl font-bold text-ez-light mb-4">
            Output Formats
          </h2>
          <p class="text-ez-light/70 mb-8">
            Pass any combination to <code class="bg-black/30 border border-ez-border-dark rounded px-1.5 py-0.5 font-mono text-sm text-ez-yellow">--format</code> as a comma-separated list. Omit the flag to get <code class="bg-black/30 border border-ez-border-dark rounded px-1.5 py-0.5 font-mono text-sm text-ez-yellow">claude,agents</code> by default.
          </p>

          <div class="space-y-3">
            {#each formats as fmt}
              <div class="flex flex-col sm:flex-row sm:items-start gap-3 rounded-lg border border-ez-border-dark bg-black/20 p-4">
                <div class="shrink-0 sm:w-24">
                  <span class="inline-block font-mono text-xs text-ez-yellow border border-ez-yellow/20 rounded px-2 py-0.5 bg-ez-yellow/5">
                    {fmt.flag}
                  </span>
                </div>
                <div class="flex-1 space-y-1">
                  <div class="flex items-baseline gap-2">
                    <span class="font-semibold text-ez-light text-sm">{fmt.name}</span>
                    <span class="font-mono text-xs text-ez-light/30">{fmt.path}</span>
                  </div>
                  <p class="text-sm text-ez-light/60">{fmt.desc}</p>
                </div>
              </div>
            {/each}
          </div>

          <div class="mt-6 rounded-lg border border-ez-border-dark bg-black/20 p-4 text-sm text-ez-light/60">
            <span class="font-semibold text-ez-light">Tip:</span> Generate all formats at once with
            <code class="font-mono text-xs text-ez-yellow">--format claude,agents,cursor,copilot,skills,rulesync,ruler</code>.
            Each format is written to its conventional location -- no extra configuration needed.
          </div>
        </div>
      </section>

      <!-- ── Section 6: Drift Detection ── -->
      <section
        id="drift-detection"
        class="py-12 md:py-16 border-b border-ez-border-dark"
        use:inview
        oninview={() => (s6 = true)}
      >
        <div class="transition-all duration-700 {s6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="scroll-mt-24 text-2xl md:text-3xl font-bold text-ez-light mb-6">
            How Drift Detection Works
          </h2>

          <div class="space-y-6 text-ez-light/70 leading-relaxed">
            <p>
              Drift detection uses semantic search to verify every claim in your context files against the actual code in your project.
            </p>

            <ol class="space-y-6 list-none">
              <li class="flex gap-4">
                <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ez-yellow/10 border border-ez-yellow/20 font-mono text-xs font-bold text-ez-yellow">1</span>
                <div>
                  <p class="font-semibold text-ez-light mb-1">Claim extraction</p>
                  <p class="text-sm">ez-context parses your context file and extracts discrete claims -- statements like "uses camelCase naming", "TypeScript strict mode enabled", or "tests live in a test/ directory".</p>
                </div>
              </li>
              <li class="flex gap-4">
                <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ez-yellow/10 border border-ez-yellow/20 font-mono text-xs font-bold text-ez-yellow">2</span>
                <div>
                  <p class="font-semibold text-ez-light mb-1">Semantic search</p>
                  <p class="text-sm">Each claim is embedded and checked against your codebase using local embeddings -- no data ever leaves your machine. The search finds supporting or contradicting evidence in your actual source files.</p>
                </div>
              </li>
              <li class="flex gap-4">
                <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ez-yellow/10 border border-ez-yellow/20 font-mono text-xs font-bold text-ez-yellow">3</span>
                <div>
                  <p class="font-semibold text-ez-light mb-1">Scoring</p>
                  <p class="text-sm">Each claim is scored as one of three states:</p>
                  <div class="mt-3 space-y-2">
                    <div class="flex items-center gap-3">
                      <span class="inline-flex items-center gap-1.5 rounded-full bg-ez-green/10 border border-ez-green/20 px-3 py-1 text-xs font-mono font-bold text-ez-green">GREEN</span>
                      <span class="text-sm text-ez-light/60">Confirmed -- code evidence supports the claim</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="inline-flex items-center gap-1.5 rounded-full bg-ez-yellow/10 border border-ez-yellow/20 px-3 py-1 text-xs font-mono font-bold text-ez-yellow">YELLOW</span>
                      <span class="text-sm text-ez-light/60">Uncertain -- insufficient evidence found</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1 text-xs font-mono font-bold text-red-400">RED</span>
                      <span class="text-sm text-ez-light/60">Contradicted -- code evidence conflicts with the claim</span>
                    </div>
                  </div>
                </div>
              </li>
              <li class="flex gap-4">
                <span class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ez-yellow/10 border border-ez-yellow/20 font-mono text-xs font-bold text-ez-yellow">4</span>
                <div>
                  <p class="font-semibold text-ez-light mb-1">Health score</p>
                  <p class="text-sm">The results are aggregated into a health score from 0 to 100. A score of 100 means all claims are confirmed. Lower scores indicate drift that should be addressed with <code class="font-mono text-xs text-ez-yellow">ez-context update</code>.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <!-- ── Section 7: Markers ── -->
      <section
        id="markers"
        class="py-12 md:py-16 border-b border-ez-border-dark"
        use:inview
        oninview={() => (s7 = true)}
      >
        <div class="transition-all duration-700 {s7 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="scroll-mt-24 text-2xl md:text-3xl font-bold text-ez-light mb-6">
            Markers
          </h2>

          <p class="text-ez-light/70 mb-6">
            All ez-context-generated content is wrapped in HTML comment markers. The markers make it possible to update the generated section without touching anything you've written by hand.
          </p>

          <pre class="bg-black/40 border border-ez-border-dark rounded-lg px-4 py-4 font-mono text-sm overflow-x-auto mb-6"><span class="text-ez-light/40">&lt;!-- ez-context:start --&gt;</span>
<span class="text-ez-green"># Project Context

## Stack
- Language: TypeScript
- Build: tsdown

## Conventions
- **naming**: functions use camelCase naming
</span><span class="text-ez-light/40">&lt;!-- ez-context:end --&gt;</span>

<span class="text-ez-light/60"># My Custom Notes

These lines are outside the markers and will NEVER be overwritten
by ez-context update. Add anything you want here.</span></pre>

          <div class="space-y-4">
            <div class="rounded-lg border border-ez-border-dark bg-black/20 p-4">
              <p class="text-sm font-semibold text-ez-light mb-1">Managed content (inside markers)</p>
              <p class="text-sm text-ez-light/60">Everything between <code class="font-mono text-xs text-ez-yellow">&lt;!-- ez-context:start --&gt;</code> and <code class="font-mono text-xs text-ez-yellow">&lt;!-- ez-context:end --&gt;</code> is owned by ez-context. Running <code class="font-mono text-xs text-ez-yellow">ez-context update</code> rewrites this block with fresh analysis results.</p>
            </div>
            <div class="rounded-lg border border-ez-border-dark bg-black/20 p-4">
              <p class="text-sm font-semibold text-ez-light mb-1">Manual content (outside markers)</p>
              <p class="text-sm text-ez-light/60">Any content above or below the marker block is yours. Add project-specific guidance, agent instructions, team norms, or anything that shouldn't be auto-generated. ez-context will never touch it.</p>
            </div>
            <div class="rounded-lg border border-ez-border-dark bg-black/20 p-4">
              <p class="text-sm font-semibold text-ez-light mb-1">No markers yet?</p>
              <p class="text-sm text-ez-light/60">Running <code class="font-mono text-xs text-ez-yellow">ez-context generate</code> on an existing file will append the marker block at the end, preserving all existing content above it.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Section 8: Next steps ── -->
      <section
        class="py-12 md:py-16"
        use:inview
        oninview={() => (s8 = true)}
      >
        <div class="transition-all duration-700 {s8 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}">
          <h2 class="text-2xl font-bold text-ez-light mb-6">Next steps</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <a
              href="https://github.com/ezcorp-org/ez-context"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col gap-2 rounded-lg border border-ez-border-dark bg-black/20 p-5 hover:border-ez-yellow/30 hover:bg-black/40 transition-all duration-150 group"
            >
              <span class="font-semibold text-ez-light group-hover:text-ez-yellow transition-colors duration-150">GitHub repository &rarr;</span>
              <span class="text-sm text-ez-light/50">Source code, issues, and contribution guide.</span>
            </a>
            <a
              href="https://www.npmjs.com/package/@ez-corp/ez-context"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col gap-2 rounded-lg border border-ez-border-dark bg-black/20 p-5 hover:border-ez-yellow/30 hover:bg-black/40 transition-all duration-150 group"
            >
              <span class="font-semibold text-ez-light group-hover:text-ez-yellow transition-colors duration-150">npm package &rarr;</span>
              <span class="text-sm text-ez-light/50">Version history and install stats.</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  </div>
</main>

<Footer />
