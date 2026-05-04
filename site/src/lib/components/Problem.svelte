<script lang="ts">
  import { inview } from '$lib/utils/inview';

  let visible = $state(false);
</script>

<section
  id="problem"
  class="py-16 md:py-24 px-6 md:px-8"
  use:inview
  oninview={() => (visible = true)}
>
  <div
    class="max-w-7xl mx-auto transition-all duration-700 {visible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-8'}"
  >
    <div class="max-w-3xl mx-auto space-y-8">
      <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-ez-light">
        Context rot is real. And it's probably happening to you right now.
      </h2>

      <p class="text-base md:text-lg text-ez-light/70">
        Your context files drift. Every refactor, every rename, every architectural decision
        widens the gap between what your AI reads and what your code does. You started with
        Express.js. You migrated to Hono six months ago. Your CLAUDE.md still says Express.
      </p>

      <!-- Visual comparison -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <!-- Stale claim -->
        <div class="rounded-lg border border-red-500/30 bg-red-500/5 p-5">
          <div class="mb-3 flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-red-500"></span>
            <span class="text-xs font-mono text-red-400 uppercase tracking-wider">CLAUDE.md says</span>
          </div>
          <div class="font-mono text-sm text-ez-light/80 leading-relaxed space-y-1">
            <div class="text-ez-light/40">## Tech Stack</div>
            <div></div>
            <div>- Language: TypeScript</div>
            <div class="flex items-center gap-2">
              <span>- Framework:</span>
              <span class="text-red-400 line-through">Express.js</span>
              <span class="text-xs text-red-400 bg-red-500/20 px-1 rounded">stale</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-red-400/60 line-through">- REST API patterns</span>
            </div>
          </div>
        </div>

        <!-- Actual code -->
        <div class="rounded-lg border border-ez-green/30 bg-ez-green/5 p-5">
          <div class="mb-3 flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-ez-green"></span>
            <span class="text-xs font-mono text-ez-green uppercase tracking-wider">Your code does</span>
          </div>
          <div class="font-mono text-sm leading-relaxed space-y-1 text-ez-light/80">
            <div>
              <span class="text-ez-purple">import</span>
              <span class="text-ez-green"> Hono</span>
              <span class="text-ez-purple"> from</span>
              <span class="text-ez-yellow"> 'hono'</span>;
            </div>
            <div>
              <span class="text-ez-purple">import</span>
              <span> &#123; cors &#125;</span>
              <span class="text-ez-purple"> from</span>
              <span class="text-ez-yellow"> 'hono/cors'</span>;
            </div>
            <div class="mt-2">
              <span class="text-ez-purple">const</span>
              <span> app =</span>
              <span class="text-ez-purple"> new</span>
              <span class="text-ez-green"> Hono</span>
              <span>();</span>
            </div>
          </div>
        </div>
      </div>

      <p class="text-base md:text-lg text-ez-light/70">
        Your AI assistant is now suggesting patterns that don't exist in your codebase.
        Hallucination-adjacent, but entirely your fault. <span class="text-ez-light">ez-context finds the gaps and patches them.</span>
      </p>
    </div>
  </div>
</section>
