<script lang="ts">
  import { inview } from '$lib/utils/inview';

  let visible = $state(false);

  const formats = [
    {
      name: 'CLAUDE.md',
      path: 'CLAUDE.md',
      desc: 'Anthropic Claude Code context file. Used by claude-code and MCP-compatible tools.'
    },
    {
      name: 'AGENTS.md',
      path: 'AGENTS.md',
      desc: 'Linux Foundation agent standard. Cross-platform context for any agent runtime.'
    },
    {
      name: 'Cursor Rules',
      path: '.cursor/rules/*.mdc',
      desc: 'Cursor IDE rules in MDC format with glob-scoped context per rule.'
    },
    {
      name: 'Copilot',
      path: '.github/copilot-instructions.md',
      desc: 'GitHub Copilot workspace instructions. Injected into every Copilot interaction.'
    },
    {
      name: 'SKILL.md',
      path: 'SKILL.md',
      desc: 'Skill modules with progressive disclosure. Structured for agent skill registries.'
    },
    {
      name: 'Rulesync',
      path: '.rulesync/*.md',
      desc: 'Rulesync format for cross-editor rule synchronization and sharing.'
    },
    {
      name: 'Ruler',
      path: '.ruler/*.md',
      desc: 'Ruler format for opinionated context organization with tagging support.'
    }
  ];
</script>

<section
  id="formats"
  class="py-16 md:py-24 px-6 md:px-8"
  use:inview
  oninview={() => (visible = true)}
>
  <div
    class="max-w-7xl mx-auto transition-all duration-700 {visible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-8'}"
  >
    <div class="text-center mb-12">
      <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-ez-light mb-4">
        One tool. Every format.
      </h2>
      <p class="text-base md:text-lg text-ez-light/70">
        Generate all 7 formats at once, or pick exactly what you need.
      </p>
    </div>

    <!-- Scrollable card row -->
    <div class="overflow-x-auto pb-4 -mx-6 md:-mx-8 px-6 md:px-8">
      <div class="flex gap-4 min-w-max md:min-w-0 md:grid md:grid-cols-4 lg:grid-cols-7">
        {#each formats as fmt}
          <div class="w-52 md:w-auto border border-ez-border-dark rounded-lg p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 bg-black/20 flex flex-col gap-2">
            <div class="font-mono text-sm font-bold text-ez-yellow">{fmt.name}</div>
            <div class="font-mono text-xs text-ez-light/40 truncate">{fmt.path}</div>
            <p class="text-xs text-ez-light/60 leading-relaxed flex-1">{fmt.desc}</p>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>
