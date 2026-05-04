<script lang="ts">
  import { inview } from '$lib/utils/inview';

  let visible = $state(false);
  let copied = $state(false);

  const installCmd = 'npm install -g @ez-corp/ez-context';

  async function copyInstall() {
    await navigator.clipboard.writeText(installCmd);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<section
  id="install"
  class="py-16 md:py-24 px-6 md:px-8"
  use:inview
  oninview={() => (visible = true)}
>
  <div
    class="max-w-7xl mx-auto transition-all duration-700 {visible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-8'}"
  >
    <div class="max-w-2xl mx-auto text-center space-y-8">
      <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-ez-light">
        Get started in 10 seconds.
      </h2>

      <p class="text-base md:text-lg text-ez-light/70">
        Free. Open source. ISC license. No accounts required.
      </p>

      <!-- Main install block -->
      <div class="flex items-center gap-3 rounded-xl border border-ez-border-dark bg-black/60 px-5 py-4 text-left">
        <span class="text-ez-green font-mono text-sm sm:text-base flex-1 select-all">
          {installCmd}
        </span>
        <button
          onclick={copyInstall}
          class="shrink-0 rounded-md border border-ez-border-dark bg-white/5 px-4 py-2 text-sm font-semibold text-ez-light/70 hover:bg-white/10 hover:text-ez-light transition-colors duration-150"
          aria-label="Copy install command"
        >
          {#if copied}
            <span class="text-ez-green">&#10003; Copied!</span>
          {:else}
            Copy
          {/if}
        </button>
      </div>

      <!-- Quick-start commands -->
      <div class="space-y-3 text-left">
        <div class="flex items-start gap-4 rounded-lg border border-ez-border-dark bg-black/30 px-5 py-4">
          <code class="font-mono text-sm text-ez-yellow whitespace-nowrap">ez-context generate</code>
          <span class="text-sm text-ez-light/60">Generate context files from your codebase</span>
        </div>
        <div class="flex items-start gap-4 rounded-lg border border-ez-border-dark bg-black/30 px-5 py-4">
          <code class="font-mono text-sm text-ez-yellow whitespace-nowrap">ez-context drift</code>
          <span class="text-sm text-ez-light/60">Check your existing files for drift</span>
        </div>
      </div>

      <!-- Links -->
      <div class="flex items-center justify-center gap-6 text-sm">
        <a
          href="https://github.com/ezcorp-org/ez-context"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-ez-light/60 hover:text-ez-light transition-colors duration-150"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          GitHub
        </a>
        <a
          href="https://www.npmjs.com/package/@ez-corp/ez-context"
          target="_blank"
          rel="noopener noreferrer"
          class="text-ez-light/60 hover:text-ez-light transition-colors duration-150"
        >
          npm package
        </a>
      </div>

      <p class="text-xs text-ez-light/40">
        Free. Open source. ISC license. No accounts, no telemetry.
      </p>
    </div>
  </div>
</section>
