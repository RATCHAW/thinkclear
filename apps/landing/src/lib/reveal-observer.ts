/**
 * One IntersectionObserver for every scroll reveal on the page.
 *
 * A dozen sections each constructing their own observer is a dozen sets of
 * intersection callbacks the browser has to keep in step on scroll. One shared
 * observer with a map of elements to callbacks costs the same as one section
 * did, and each element unsubscribes itself the moment it has fired — the
 * reveal is once-only, so nothing here stays registered after it has been seen.
 */

type RevealCallback = () => void;

const callbacks = new Map<Element, RevealCallback>();

let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = callbacks.get(entry.target);
        // Unregister before firing: the reveal never repeats, and leaving the
        // element observed would keep calling setState on every scroll past.
        unobserveReveal(entry.target);
        callback?.();
      }
    },
    // A little inside the fold, so a section animates as it is being read into
    // rather than the instant its first pixel appears.
    { rootMargin: "0px 0px -12% 0px" },
  );
  return observer;
}

/**
 * Watch `element` and call `onVisible` once. Returns the unsubscribe. When the
 * browser has no IntersectionObserver the element is revealed immediately —
 * the animation is decoration, and content that never appears is not a
 * graceful degradation.
 */
export function observeReveal(
  element: Element,
  onVisible: RevealCallback,
): () => void {
  const shared = getObserver();
  if (!shared) {
    onVisible();
    return () => {};
  }
  callbacks.set(element, onVisible);
  shared.observe(element);
  return () => unobserveReveal(element);
}

function unobserveReveal(element: Element): void {
  callbacks.delete(element);
  observer?.unobserve(element);
}
