<script lang="ts">
  import { inview } from '$lib/utils/inview';
  import { onMount } from 'svelte';

  let visible = $state(false);
  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });

  // Each line: { text, color, delay (seconds), indent }
  const lines = [
    { text: '$ ez-context generate', color: 'text-ez-light', delay: 0.2, prompt: true },
    { text: 'Analyzing project structure...', color: 'text-white/60', delay: 0.7 },
    { text: 'Extracting conventions from 47 files...', color: 'text-white/60', delay: 1.2 },
    { text: 'Generated CLAUDE.md (2.1kb)', color: 'text-ez-green', delay: 1.9 },
    { text: 'Generated AGENTS.md (1.8kb)', color: 'text-ez-green', delay: 2.3 },
    { text: '', color: '', delay: 2.6 },
    { text: '$ ez-context drift', color: 'text-ez-light', delay: 3.0, prompt: true },
    { text: 'Checking 12 claims against codebase...', color: 'text-white/60', delay: 3.5 },
    { text: 'Health score: 94/100', color: 'text-ez-green font-bold text-base', delay: 4.2 },
    { text: '2 claims need attention', color: 'text-ez-yellow', delay: 4.7 },
  ];
</script>

<section
  id="demo"
  class="py-16 md:py-24 px-6 md:px-8"
  use:inview
  oninview={() => (visible = true)}
>
  <div class="max-w-7xl mx-auto">
    <div class="max-w-2xl mx-auto">
      <div class="mb-8 text-center">
        <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-ez-light mb-4">
          Watch it work.
        </h2>
        <p class="text-base md:text-lg text-ez-light/70">
          Two commands. One for generation, one for drift detection.
        </p>
      </div>

      <!-- Terminal window -->
      <div class="rounded-xl border border-white/10 bg-black/90 overflow-hidden shadow-2xl">
        <!-- Title bar -->
        <div class="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
          <span class="h-3 w-3 rounded-full bg-red-500/80"></span>
          <span class="h-3 w-3 rounded-full bg-yellow-500/80"></span>
          <span class="h-3 w-3 rounded-full bg-green-500/80"></span>
          <span class="ml-3 text-xs font-mono text-white/30">ez-context</span>
        </div>

        <!-- Terminal body -->
        <div class="p-5 min-h-[260px] font-mono text-sm leading-relaxed">
          {#each lines as line, i}
            {#if line.text === ''}
              <!-- Empty spacer line -->
              <div
                class="h-4 {mounted && visible ? 'animate-fadein' : 'opacity-0'}"
                style="animation-delay: {line.delay}s; animation-fill-mode: both;"
              ></div>
            {:else}
              <div
                class="{line.color} {mounted && visible ? 'animate-fadein' : 'opacity-0'}"
                style="animation-delay: {line.delay}s; animation-fill-mode: both;"
              >
                {line.text}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(.animate-fadein) {
    animation-name: fadein;
    animation-duration: 0.4s;
    animation-timing-function: ease-out;
    animation-fill-mode: both;
  }
</style>
