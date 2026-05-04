<script lang="ts">
  import { inview } from '$lib/utils/inview';

  let visible = $state(false);
</script>

<footer
  class="border-t border-ez-border-dark py-8 px-6 md:px-8"
  use:inview
  oninview={() => (visible = true)}
>
  <div
    class="max-w-7xl mx-auto transition-all duration-700 {visible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-8'}"
  >
    <div class="flex flex-col items-center gap-4 text-center">
      <p class="text-base font-semibold text-ez-light">
        Built by <a href="https://ezcorp.org" target="_blank" rel="noopener noreferrer" class="text-ez-light hover:text-ez-yellow transition-colors duration-150 underline underline-offset-2">EZCorp</a>. <span class="text-ez-yellow">Make it EZ.</span>
      </p>

      <div class="flex items-center gap-6 text-sm">
        <a
          href="/docs"
          class="text-ez-light/50 hover:text-ez-light transition-colors duration-150"
        >
          Docs
        </a>
        <a
          href="https://github.com/ezcorp-org/ez-context"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-ez-light/50 hover:text-ez-light transition-colors duration-150"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          GitHub
        </a>
        <a
          href="https://www.npmjs.com/package/@ez-corp/ez-context"
          target="_blank"
          rel="noopener noreferrer"
          class="text-ez-light/50 hover:text-ez-light transition-colors duration-150"
        >
          npm
        </a>
      </div>

      <p class="text-xs text-ez-light/30">
        ez-context is open source under the ISC license
      </p>
    </div>
  </div>
</footer>
