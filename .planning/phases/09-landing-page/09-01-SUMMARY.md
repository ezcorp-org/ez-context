---
phase: 09-landing-page
plan: "01"
subsystem: ui
tags: [sveltekit, tailwind, cloudflare, vite, fontsource, inter, jetbrains-mono, svelte5]

# Dependency graph
requires: []
provides:
  - SvelteKit 5 project scaffold in site/ directory
  - Tailwind v4 brand tokens (ez-yellow, ez-blue, ez-green, ez-purple, ez-dark, ez-light)
  - Inter Variable and JetBrains Mono fonts via Fontsource
  - Cloudflare Workers deployment config (wrangler.jsonc + adapter-cloudflare)
  - Intersection Observer scroll reveal Svelte action (inview.ts)
  - Prerendered static site configuration
affects:
  - 09-landing-page/09-02 (components built on this scaffold)
  - 09-landing-page/09-03 (deployment uses wrangler.jsonc)

# Tech tracking
tech-stack:
  added:
    - "@sveltejs/kit@2.53.4"
    - "svelte@5.53.7"
    - "@sveltejs/adapter-cloudflare@7.2.8"
    - "tailwindcss@4.2.1"
    - "@tailwindcss/vite@4.2.1"
    - "vite@6.4.1"
    - "wrangler@4.70.0"
    - "@fontsource-variable/inter@5.2.8"
    - "@fontsource-variable/jetbrains-mono@5.2.8"
    - "svelte-check@4.4.4"
  patterns:
    - "Tailwind v4 CSS-first @theme (no tailwind.config.js)"
    - "tailwindcss() Vite plugin before sveltekit() in vite.config.ts"
    - "export const prerender = true in +layout.ts cascades to all routes"
    - "Svelte 5 rune syntax: $props(), {@render children()}"
    - "Fontsource fonts imported via @import in app.css (Vite processes them)"

key-files:
  created:
    - site/package.json
    - site/svelte.config.js
    - site/vite.config.ts
    - site/wrangler.jsonc
    - site/tsconfig.json
    - site/src/app.html
    - site/src/app.css
    - site/src/routes/+layout.svelte
    - site/src/routes/+layout.ts
    - site/src/routes/+page.svelte
    - site/src/lib/utils/inview.ts
    - site/static/favicon.svg
    - site/.gitignore
  modified: []

key-decisions:
  - "SVG favicon instead of PNG -- avoids prerender 404 without needing an image asset pipeline"
  - "Use bun install for site/ (consistent with root project; bun.lock committed)"
  - "site/ is a fully independent package (own package.json, own bun.lock)"
  - "Font imports in app.css via @import (not +layout.svelte script) -- works with Tailwind v4 Vite pipeline"

patterns-established:
  - "Pattern: Tailwind v4 brand tokens in @theme generate utility classes like bg-ez-yellow, text-ez-blue"
  - "Pattern: Svelte 5 layout with $props() and {@render children()} -- no slot/legacy syntax"
  - "Pattern: inview Svelte action uses IntersectionObserver, fires once, calls destroy() on cleanup"

# Metrics
duration: 12min
completed: 2026-03-03
---

# Phase 9 Plan 01: Landing Page Scaffold Summary

**SvelteKit 5 + Tailwind v4 + Cloudflare Workers project in site/ with brand tokens, self-hosted fonts, prerender config, and Intersection Observer scroll reveal action**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-03T23:53:45Z
- **Completed:** 2026-03-03T00:06:00Z
- **Tasks:** 2
- **Files modified:** 13 created

## Accomplishments

- Full SvelteKit 5 project scaffold with Cloudflare adapter, Tailwind v4 Vite plugin, and TypeScript
- Brand color palette (ez-yellow, ez-blue, ez-green, ez-purple, ez-dark, ez-light) available as Tailwind utilities via @theme
- Self-hosted Inter Variable and JetBrains Mono fonts loaded through Fontsource + Tailwind CSS pipeline
- `export const prerender = true` in +layout.ts makes entire site statically prerendered at build time
- `inview.ts` Svelte action ready for scroll reveal animations in Plan 02 components
- `bun run build` produces `.svelte-kit/cloudflare/_worker.js` deployable to Cloudflare Workers

## Task Commits

Each task was committed atomically:

1. **Task 1: SvelteKit project with all dependencies** - `8a765bb` (feat)
2. **Task 2: App styles, layout, scroll utility, placeholder page** - `4395105` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `site/package.json` - Project with SvelteKit 5, Tailwind v4, adapter-cloudflare, fontsource deps
- `site/svelte.config.js` - adapter-cloudflare + vitePreprocess
- `site/vite.config.ts` - tailwindcss() before sveltekit() in plugins array
- `site/wrangler.jsonc` - Cloudflare Workers Static Assets config
- `site/tsconfig.json` - extends .svelte-kit/tsconfig.json
- `site/src/app.html` - HTML shell with SVG favicon
- `site/src/app.css` - Tailwind v4 @import + @theme brand tokens + @layer base dark defaults
- `site/src/routes/+layout.svelte` - Svelte 5 $props() + {@render children()}
- `site/src/routes/+layout.ts` - export const prerender = true
- `site/src/routes/+page.svelte` - Placeholder proving fonts, colors, Tailwind utilities work
- `site/src/lib/utils/inview.ts` - IntersectionObserver action for scroll reveals
- `site/static/favicon.svg` - SVG favicon (ez-yellow background, dark "ez" text)
- `site/.gitignore` - .svelte-kit, node_modules, build, .wrangler

## Decisions Made

- **SVG favicon instead of PNG:** app.html referenced `/favicon.png` which caused a prerender 404 error. Created an SVG favicon and updated the reference. SVG is smaller and scales perfectly.
- **bun install for site/:** Consistent with root project tooling. bun.lock committed alongside package.json.
- **site/ as independent package:** Has its own package.json and bun.lock; not a workspace member of the root. Avoids dependency conflicts between the CLI tool and landing site.
- **Font imports in app.css:** @import in app.css (processed by Vite) works correctly with Tailwind v4's Vite plugin. This follows the Fontsource docs and avoids layout.svelte import ordering issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing favicon asset caused prerender 404**

- **Found during:** Task 2 (first build attempt)
- **Issue:** `app.html` referenced `%sveltekit.assets%/favicon.png` but no `static/favicon.png` existed. SvelteKit's prerender step follows links and throws on 404.
- **Fix:** Created `site/static/favicon.svg` (ez-yellow branded SVG icon) and updated `app.html` to reference `favicon.svg` with `type="image/svg+xml"`.
- **Files modified:** site/src/app.html, site/static/favicon.svg
- **Verification:** `bun run build` exits 0, `.svelte-kit/cloudflare/` directory produced
- **Committed in:** 8a765bb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Favicon was a mandatory asset for the build to succeed. SVG favicon is preferable anyway (scalable, smaller). No scope creep.

## Issues Encountered

None beyond the favicon deviation above.

## User Setup Required

None - no external service configuration required for local dev and build. Deployment requires `wrangler login` (handled in Plan 03).

## Next Phase Readiness

- site/ builds successfully: `bun run build` exits 0
- `.svelte-kit/cloudflare/` output directory confirmed
- All brand tokens available as Tailwind utilities (bg-ez-yellow, text-ez-blue, font-mono, etc.)
- Inter Variable and JetBrains Mono font files bundled in build output
- `inview.ts` exported and ready for use by Plan 02 components
- Plan 02 can immediately start building Hero, DemoTerminal, Features, etc. on this foundation

---
*Phase: 09-landing-page*
*Completed: 2026-03-03*
