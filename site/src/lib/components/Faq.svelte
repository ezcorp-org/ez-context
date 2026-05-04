<script lang="ts">
  import { inview } from '$lib/utils/inview';

  let visible = $state(false);

  const faqs = [
    {
      q: 'Is it free?',
      a: 'Yes. Free, open source, ISC license. No accounts, no telemetry, no BS.'
    },
    {
      q: 'Does it work with my editor?',
      a: 'If your editor reads CLAUDE.md, .cursorrules, or copilot-instructions.md, yes. We generate for Claude Code, Cursor, GitHub Copilot, and more.'
    },
    {
      q: 'What languages does it support?',
      a: 'TypeScript, Go, and Rust. More languages are coming. The static analysis works on any project with a package.json or go.mod.'
    },
    {
      q: 'Does it phone home?',
      a: 'No. Everything runs locally. Your code never leaves your machine.'
    },
    {
      q: 'How does drift detection work?',
      a: 'We parse claims from your context files, embed them, and compare against your codebase using semantic search. Each claim gets a confidence score.'
    }
  ];
</script>

<section
  id="faq"
  class="py-16 md:py-24 px-6 md:px-8"
  use:inview
  oninview={() => (visible = true)}
>
  <div
    class="max-w-7xl mx-auto transition-all duration-700 {visible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-8'}"
  >
    <div class="max-w-2xl mx-auto">
      <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-ez-light mb-10">
        Frequently asked questions.
      </h2>

      <div class="divide-y divide-ez-border-dark">
        {#each faqs as faq}
          <details class="group py-1">
            <summary
              class="cursor-pointer list-none flex items-center justify-between py-4 font-semibold text-ez-light hover:text-ez-yellow transition-colors duration-150 select-none"
            >
              {faq.q}
              <svg
                class="h-5 w-5 shrink-0 text-ez-light/40 transition-transform duration-200 group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p class="pb-4 text-base md:text-lg text-ez-light/70">
              {faq.a}
            </p>
          </details>
        {/each}
      </div>
    </div>
  </div>
</section>
