<script lang="ts">
  let copied = $state(false);

  const installCmd = 'npm install -g @ez-corp/ez-context';

  async function copyInstall() {
    await navigator.clipboard.writeText(installCmd);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<section class="relative min-h-screen flex flex-col items-center justify-center px-6 md:px-8 py-24 overflow-hidden">
  <!-- Background glow -->
  <div
    class="pointer-events-none absolute inset-0 flex items-center justify-center"
    aria-hidden="true"
  >
    <div
      class="h-[600px] w-[900px] rounded-full opacity-10 blur-[120px]"
      style="background: radial-gradient(ellipse, #F4C430 0%, #0066FF 50%, transparent 80%);"
    ></div>
  </div>

  <div class="relative z-10 max-w-4xl w-full mx-auto text-center space-y-8">
    <!-- Logo -->
    <div class="flex justify-center">
      <img src="/logo.svg" alt="ez-context logo" class="h-24 md:h-32 w-auto" />
    </div>

    <!-- Badge -->
    <div class="inline-flex items-center gap-2 rounded-full border border-ez-border-dark bg-black/40 px-4 py-1.5 text-sm text-ez-light/60 font-mono">
      <span class="h-2 w-2 rounded-full bg-ez-green animate-pulse"></span>
      Open source &middot; ISC license &middot; No telemetry
    </div>

    <!-- Headline -->
    <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-ez-light">
      Your AI context files are
      <span class="text-ez-yellow italic"> lying</span> to you.
    </h1>

    <!-- Subheadline -->
    <p class="max-w-2xl mx-auto text-base md:text-xl text-ez-light/70">
      ez-context detects when CLAUDE.md, Cursor rules, and Copilot instructions drift from
      what your code actually does&thinsp;&mdash;&thinsp;then fixes them.
    </p>

    <!-- Install CTA -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <div class="flex items-center gap-2 rounded-lg border border-ez-border-dark bg-black/60 px-4 py-3 w-full sm:w-auto">
        <span class="text-ez-green font-mono text-sm select-all whitespace-nowrap">
          {installCmd}
        </span>
        <button
          onclick={copyInstall}
          class="ml-2 shrink-0 rounded-md border border-ez-border-dark bg-white/5 px-3 py-1 text-xs font-semibold text-ez-light/70 hover:bg-white/10 hover:text-ez-light transition-colors duration-150"
          aria-label="Copy install command"
        >
          {#if copied}
            <span class="text-ez-green">&#10003; Copied!</span>
          {:else}
            Copy
          {/if}
        </button>
      </div>
    </div>

    <!-- Secondary CTA -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a
        href="#demo"
        class="inline-flex items-center gap-2 text-sm text-ez-light/50 hover:text-ez-light transition-colors duration-150"
      >
        See how it works
        <svg class="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </a>
      <span class="hidden sm:block text-ez-light/20">&#183;</span>
      <a
        href="/docs"
        class="text-sm text-ez-light/50 hover:text-ez-light transition-colors duration-150"
      >
        Read the docs
      </a>
    </div>
  </div>
</section>
