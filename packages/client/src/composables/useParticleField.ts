import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

export type ParticleFieldOptions = {
  /** Max link distance in CSS pixels. Default 120. */
  linkDistance?: number;
  /** Particle fill color RGB. Default `90, 150, 255`. */
  particleRgb?: string;
  /** Link stroke RGB. Default `70, 130, 220`. */
  linkRgb?: string;
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function spawnCount(w: number, h: number) {
  const area = w * h;
  return Math.min(90, Math.max(36, Math.floor(area / 18000)));
}

function createParticles(w: number, h: number): Particle[] {
  const n = spawnCount(w, h);
  return Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35 - 0.12,
    r: 1 + Math.random() * 2.2,
    a: 0.35 + Math.random() * 0.45,
  }));
}

/**
 * Canvas particle field with near-distance links.
 * Bind `canvasRef` to a `<canvas>` that fills its positioned parent.
 */
export function useParticleField(options: ParticleFieldOptions = {}) {
  const linkDistance = options.linkDistance ?? 120;
  const particleRgb = options.particleRgb ?? '90, 150, 255';
  const linkRgb = options.linkRgb ?? '70, 130, 220';

  const canvasRef: Ref<HTMLCanvasElement | null> = ref(null);

  let raf = 0;
  let particles: Particle[] = [];
  let reduceMotion = false;
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resizeCanvas() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = parent.clientWidth;
    height = parent.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!particles.length || particles.length !== spawnCount(width, height)) {
      particles = createParticles(width, height);
    }
  }

  function drawFrame() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j]!;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= linkDistance) continue;
        const alpha = (1 - dist / linkDistance) * 0.22;
        ctx.strokeStyle = `rgba(${linkRgb}, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }

    for (const p of particles) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${particleRgb}, ${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step() {
    if (!reduceMotion) {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }
    }
    drawFrame();
    if (!reduceMotion) {
      raf = window.requestAnimationFrame(step);
    }
  }

  function onResize() {
    resizeCanvas();
    drawFrame();
  }

  onMounted(() => {
    reduceMotion = prefersReducedMotion();
    resizeCanvas();
    drawFrame();
    if (!reduceMotion) {
      raf = window.requestAnimationFrame(step);
    }
    window.addEventListener('resize', onResize);
  });

  onBeforeUnmount(() => {
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  });

  return { canvasRef };
}
