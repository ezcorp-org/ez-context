<script lang="ts">
  import { inview } from '$lib/utils/inview';

  let visible = $state(false);

  const features = [
    {
      title: 'Smart Extraction',
      desc: 'Analyzes package.json, tsconfig, CI configs, and code patterns. No manual config.'
    },
    {
      title: 'Drift Detection',
      desc: 'Compares every claim in your context files against actual code using semantic search.'
    },
    {
      title: 'Targeted Updates',
      desc: 'Rewrites only drifted sections. Your manual notes stay untouched.'
    },
    {
      title: '7 Output Formats',
      desc: 'CLAUDE.md, AGENTS.md, Cursor rules, Copilot instructions, SKILL.md, Rulesync, Ruler.'
    },
    {
      title: 'Multi-Language',
      desc: 'TypeScript, Go, and Rust. More coming.'
    },
    {
      title: 'Confidence Scores',
      desc: 'Every extracted convention includes a confidence score and evidence references.'
    }
  ];
</script>

<section
  id="features"
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
      <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-ez-light">
        Everything your context files need.
      </h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each features as feature, i}
        <div
          class="border border-ez-border-dark rounded-lg p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 bg-black/20"
          style="animation-delay: {i * 0.08}s;"
        >
          <div class="feature-icon feature-icon-{i} mb-4" aria-hidden="true">
            {#if i === 0}
              <!-- Search / Smart Extraction -->
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F4C430" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7"/>
                <line x1="16.5" y1="16.5" x2="21" y2="21"/>
              </svg>
            {:else if i === 1}
              <!-- Radar / Drift Detection -->
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <circle cx="12" cy="12" r="5"/>
                <circle cx="12" cy="12" r="1" fill="#8B5CF6"/>
                <line x1="12" y1="3" x2="12" y2="7"/>
              </svg>
            {:else if i === 2}
              <!-- Pencil / Targeted Updates -->
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00CC66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3l4 4L7 21H3v-4L17 3z"/>
              </svg>
            {:else if i === 3}
              <!-- Document / Output Formats -->
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0066FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/>
                <line x1="8" y1="17" x2="13" y2="17"/>
              </svg>
            {:else if i === 4}
              <!-- Globe / Multi-Language -->
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F4C430" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <ellipse cx="12" cy="12" rx="4" ry="9"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
              </svg>
            {:else}
              <!-- Chart / Confidence Scores -->
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="12" width="4" height="9" rx="1" fill="#8B5CF6" fill-opacity="0.2"/>
                <rect x="10" y="7" width="4" height="14" rx="1" fill="#8B5CF6" fill-opacity="0.2"/>
                <rect x="17" y="3" width="4" height="18" rx="1" fill="#8B5CF6" fill-opacity="0.2"/>
              </svg>
            {/if}
          </div>
          <h3 class="text-lg font-semibold text-ez-light mb-2">{feature.title}</h3>
          <p class="text-base text-ez-light/70">{feature.desc}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .feature-icon {
    width: 32px;
    height: 32px;
  }

  /* Search - gentle float */
  .feature-icon-0 svg {
    animation: icon-float 6s ease-in-out infinite;
  }

  /* Radar - subtle pulse */
  .feature-icon-1 svg {
    animation: icon-pulse 7s ease-in-out infinite;
  }

  /* Pencil - slight tilt */
  .feature-icon-2 svg {
    animation: icon-tilt 7s ease-in-out infinite;
    transform-origin: bottom left;
  }

  /* Document - gentle bob */
  .feature-icon-3 svg {
    animation: icon-float 7s ease-in-out infinite;
    animation-delay: 1s;
  }

  /* Globe - slow rock */
  .feature-icon-4 svg {
    animation: icon-rock 8s ease-in-out infinite;
  }

  /* Chart - subtle breathe */
  .feature-icon-5 svg {
    animation: icon-breathe 6s ease-in-out infinite;
  }

  @keyframes icon-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }

  @keyframes icon-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }

  @keyframes icon-tilt {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(1.5deg); }
  }

  @keyframes icon-rock {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(2deg); }
    75% { transform: rotate(-2deg); }
  }

  @keyframes icon-breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }

  @media (prefers-reduced-motion: reduce) {
    .feature-icon svg {
      animation: none !important;
    }
  }
</style>
