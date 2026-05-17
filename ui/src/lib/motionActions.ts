type RevealOptions = {
  delay?: number;
  distance?: number;
  duration?: number;
  scale?: number;
};

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type MotionModule = typeof import('motion');

// motion v12 changed keyframe types for DOM elements; suppress overload errors with targeted ignores
type AnyKeyframes = Record<string, string | number | (string | number)[]>;

let motionModulePromise: Promise<MotionModule> | null = null;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function loadMotion(): Promise<MotionModule> {
  motionModulePromise ??= import('motion');
  return motionModulePromise;
}

export function pageReveal(node: HTMLElement, options: RevealOptions = {}) {
  if (prefersReducedMotion()) return {};

  let destroyed = false;
  let controls: { cancel: () => void } | null = null;

  loadMotion().then(({ animate }) => {
    if (destroyed) return;
    // @ts-ignore — motion v12 DOMKeyframesDefinition does not expose transform shorthands in TS
    controls = animate(
      node,
      {
        opacity: [0, 1],
        y: [options.distance ?? 14, 0],
        scale: [options.scale ?? 0.985, 1],
        filter: ['blur(8px)', 'blur(0px)'],
      } as AnyKeyframes,
      {
        duration: options.duration ?? 0.45,
        delay: options.delay ?? 0,
        ease: EASE,
      },
    );
  });

  return {
    destroy() {
      destroyed = true;
      controls?.cancel();
    },
  };
}

export function staggerReveal(node: HTMLElement) {
  if (prefersReducedMotion()) return {};

  const items = Array.from(node.querySelectorAll<HTMLElement>('[data-motion-item]'));
  if (items.length === 0) return {};

  items.forEach((item) => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(10px)';
  });

  let destroyed = false;
  let controls: { cancel: () => void } | null = null;

  loadMotion().then(({ animate, stagger }) => {
    if (destroyed) return;
    // @ts-ignore — motion v12 DOMKeyframesDefinition does not expose transform shorthands in TS
    controls = animate(
      items,
      { opacity: [0, 1], y: [10, 0] } as AnyKeyframes,
      {
        duration: 0.36,
        delay: stagger(0.04),
        ease: EASE,
      },
    );
  });

  return {
    destroy() {
      destroyed = true;
      controls?.cancel();
    },
  };
}

export function hoverLift(node: HTMLElement) {
  if (prefersReducedMotion()) return {};

  let controls: { cancel: () => void } | null = null;
  let animateFn: MotionModule['animate'] | null = null;

  loadMotion().then(({ animate }) => {
    animateFn = animate;
  });

  function playHover() {
    if (!animateFn) return;
    controls?.cancel();
    // @ts-ignore — motion v12 DOMKeyframesDefinition does not expose transform shorthands in TS
    controls = animateFn(
      node,
      { y: -3, scale: 1.01 } as AnyKeyframes,
      { duration: 0.22, ease: EASE },
    );
  }

  function playRest() {
    if (!animateFn) return;
    controls?.cancel();
    // @ts-ignore — motion v12 DOMKeyframesDefinition does not expose transform shorthands in TS
    controls = animateFn(
      node,
      { y: 0, scale: 1 } as AnyKeyframes,
      { duration: 0.24, ease: EASE },
    );
  }

  node.addEventListener('mouseenter', playHover);
  node.addEventListener('mouseleave', playRest);
  node.addEventListener('focus', playHover);
  node.addEventListener('blur', playRest);

  return {
    destroy() {
      controls?.cancel();
      node.removeEventListener('mouseenter', playHover);
      node.removeEventListener('mouseleave', playRest);
      node.removeEventListener('focus', playHover);
      node.removeEventListener('blur', playRest);
    },
  };
}
