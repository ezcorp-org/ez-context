/**
 * Svelte action: Intersection Observer scroll reveal.
 *
 * Usage:
 *   <div use:inview on:inview={() => visible = true}>
 *
 * Fires a custom 'inview' event when the element intersects the viewport.
 * Disconnects after the first trigger (one-shot reveal).
 */
export function inview(node: Element, params = { threshold: 0.15 }) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        node.dispatchEvent(new CustomEvent('inview'));
        observer.disconnect();
      }
    },
    { threshold: params.threshold }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
