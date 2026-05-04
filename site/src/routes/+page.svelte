<script lang="ts">
  import Hero from '$lib/components/Hero.svelte';
  import Problem from '$lib/components/Problem.svelte';
  import DemoTerminal from '$lib/components/DemoTerminal.svelte';
  import Features from '$lib/components/Features.svelte';
  import DriftDemo from '$lib/components/DriftDemo.svelte';
  import Formats from '$lib/components/Formats.svelte';
  import Install from '$lib/components/Install.svelte';
  import Faq from '$lib/components/Faq.svelte';
  import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
  <title>ez-context -- AI context files that don't lie</title>
  <meta name="description" content="Generate CLAUDE.md, AGENTS.md, Cursor rules, and Copilot instructions from your codebase. Detect drift. Fix stale context. Free and open source." />
  <meta name="keywords" content="AI context files, CLAUDE.md, AGENTS.md, cursor rules, copilot instructions, drift detection, code conventions" />

  <!-- OpenGraph -->
  <meta property="og:title" content="ez-context -- AI context files that don't lie" />
  <meta property="og:description" content="Generate CLAUDE.md, AGENTS.md, Cursor rules, and Copilot instructions from your codebase. Detect drift. Fix stale context. Free and open source." />
  <meta property="og:url" content="https://ez-context.ezcorp.org" />
  <meta property="og:type" content="website" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="ez-context -- AI context files that don't lie" />
  <meta name="twitter:description" content="Generate CLAUDE.md, AGENTS.md, Cursor rules, and Copilot instructions from your codebase. Detect drift. Fix stale context. Free and open source." />

  <!-- Canonical -->
  <link rel="canonical" href="https://ez-context.ezcorp.org" />
</svelte:head>

<!-- Skip to main content (visually hidden until focused) -->
<a
  href="#main"
  class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-ez-yellow focus:px-4 focus:py-2 focus:text-ez-dark focus:font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ez-yellow focus-visible:ring-offset-2"
>
  Skip to main content
</a>

<main id="main">
  <Hero />
  <Problem />
  <DemoTerminal />
  <Features />
  <DriftDemo />
  <Formats />
  <Install />
  <Faq />
</main>

<Footer />
