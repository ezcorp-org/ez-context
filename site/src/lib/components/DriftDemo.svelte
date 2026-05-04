<script lang="ts">
  import { inview } from '$lib/utils/inview';
  import { onMount } from 'svelte';

  interface FilePanel {
    name: string;
    heading: string;
    staticLine: string;
    driftLine: { prefix: string; oldValue: string; newValue: string };
  }

  const files: FilePanel[] = [
    {
      name: 'CLAUDE.md',
      heading: '## Tech Stack',
      staticLine: 'Language: TypeScript',
      driftLine: { prefix: 'Framework: ', oldValue: 'Express.js', newValue: 'Hono' }
    },
    {
      name: '.cursor/rules/api.mdc',
      heading: '## API Layer',
      staticLine: 'Pattern: REST endpoints',
      driftLine: { prefix: 'Router: ', oldValue: 'Express Router', newValue: 'Hono routes' }
    },
    {
      name: 'copilot-instructions.md',
      heading: '## Server',
      staticLine: 'Runtime: Node.js 22',
      driftLine: { prefix: 'Framework: ', oldValue: 'Express.js', newValue: 'Hono' }
    }
  ];

  let visible = $state(false);
  let scoreValue = $state(0);
  let mounted = $state(false);
  let corrected = $state(false);
  let phase = $state<'striking' | 'replacing' | 'idle'>('idle');
  let reducedMotion = $state(false);

  let timeoutIds: ReturnType<typeof setTimeout>[] = [];

  onMount(() => {
    mounted = true;
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  });

  function scheduleTimeout(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timeoutIds.push(id);
    return id;
  }

  function animateScore(target: number) {
    if (reducedMotion) {
      scoreValue = target;
      return;
    }

    let start: number | null = null;
    const from = scoreValue;
    const duration = 800;

    function step(timestamp: number) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      scoreValue = Math.round(from + (target - from) * eased);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  function runSequence() {
    if (reducedMotion) return;

    // Strike through all simultaneously
    scheduleTimeout(() => {
      phase = 'striking';
    }, 2000);

    // Crossfade all to new values
    scheduleTimeout(() => {
      phase = 'replacing';
      corrected = true;
      animateScore(97);
    }, 2800);

    // Fade green highlights
    scheduleTimeout(() => {
      phase = 'idle';
    }, 3400);

    // Reset and loop
    scheduleTimeout(() => {
      corrected = false;
      phase = 'idle';
      animateScore(62);

      scheduleTimeout(() => {
        runSequence();
      }, 1000);
    }, 6400);
  }

  function onVisible() {
    visible = true;

    if (reducedMotion) {
      corrected = true;
      scoreValue = 97;
      return;
    }

    animateScore(62);
    scheduleTimeout(() => runSequence(), 500);
  }

  function scoreColor(score: number): string {
    if (score >= 80) return 'text-ez-green';
    if (score >= 60) return 'text-ez-yellow';
    return 'text-red-400';
  }
</script>

<section
  id="drift"
  class="py-16 md:py-24 px-6 md:px-8"
  use:inview
  oninview={onVisible}
>
  <div
    class="max-w-7xl mx-auto transition-all duration-700 {visible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-8'}"
  >
    <div class="text-center mb-12">
      <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-ez-light">
        Drift happens. We catch it.
      </h2>
    </div>

    <!-- Multi-file panels -->
    <div class="max-w-4xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-3 gap-4">
      {#each files as file}
        <div class="rounded-lg border border-ez-light/10 bg-ez-dark/80 overflow-hidden shadow-lg">
          <!-- Title bar -->
          <div class="flex items-center gap-2 px-4 py-2.5 border-b border-ez-light/10 bg-ez-light/5">
            <span class="h-3 w-3 rounded-full bg-ez-yellow/80"></span>
            <span class="font-mono text-sm text-ez-light/60 truncate">{file.name}</span>
          </div>

          <!-- File content -->
          <div class="p-5 font-mono text-sm leading-relaxed">
            <div class="text-ez-light/40 mb-3">{file.heading}</div>
            <div class="text-ez-light/70 mb-1">{file.staticLine}</div>

            <div class="relative h-7 flex items-center">
              <span class="text-ez-light/70">{file.driftLine.prefix}</span>
              <span class="relative">
                <!-- Old value -->
                <span
                  class="drift-value transition-all duration-500
                    {corrected ? 'opacity-0 absolute' : 'opacity-100'}
                    {!corrected && phase === 'striking' ? 'line-through decoration-red-400 text-red-400 bg-red-500/10 px-1 rounded' : ''}
                    {!corrected && phase !== 'striking' ? 'text-ez-light/70' : ''}"
                >{file.driftLine.oldValue}</span>
                <!-- New value -->
                <span
                  class="drift-value transition-all duration-500
                    {corrected ? 'opacity-100' : 'opacity-0 absolute'}
                    {corrected && phase === 'replacing' ? 'text-ez-green bg-ez-green/10 px-1 rounded' : ''}
                    {corrected && phase !== 'replacing' ? 'text-ez-light/70' : ''}"
                >{file.driftLine.newValue}</span>
              </span>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Health score bar -->
    <div class="max-w-lg mx-auto">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-ez-light/70">Context health score</span>
        <span
          class="text-2xl font-bold tabular-nums {scoreColor(scoreValue)}"
        >
          {scoreValue}<span class="text-base font-normal text-ez-light/40">/100</span>
        </span>
      </div>

      <div class="h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-700 ease-out"
          style="width: {visible ? scoreValue : 0}%; background: linear-gradient(to right, #ef4444, #f59e0b 40%, #00CC66 75%);"
        ></div>
      </div>

      <p class="mt-3 text-xs text-ez-light/40 text-center">
        After running <code class="font-mono text-ez-yellow">ez-context drift</code>
      </p>
    </div>
  </div>
</section>

<style>
  .drift-value {
    white-space: nowrap;
  }
</style>
