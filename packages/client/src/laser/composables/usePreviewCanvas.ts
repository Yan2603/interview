import { onBeforeUnmount, ref, type Ref } from 'vue';
import type { PathSnapshot } from '../types';

type Point = { x: number; y: number };

function rectPathToPoints(d: string): Point[] {
  // Expect: M L T H R V B H L Z  (from boundsToPathD)
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  // boundsToPathD: M l t H r V b H l Z → nums: l,t,r,b,l
  if (nums.length < 5) return [];
  const left = nums[0]!;
  const top = nums[1]!;
  const right = nums[2]!;
  const bottom = nums[3]!;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: left, y: top },
  ];
}

export function usePreviewCanvas(canvasEl: Ref<HTMLCanvasElement | null>) {
  const playing = ref(false);
  const progress = ref(0); // 0..1
  let ctx: CanvasRenderingContext2D | null = null;
  let paths: PathSnapshot[] = [];
  let raf = 0;
  let segmentIndex = 0;
  let edgeProgress = 0;
  const SPEED = 4; // px per frame along edges

  function ensureCtx() {
    if (!canvasEl.value) return null;
    if (!ctx) {
      ctx = canvasEl.value.getContext('2d');
      canvasEl.value.width = 900;
      canvasEl.value.height = 560;
    }
    return ctx;
  }

  function clear() {
    const c = ensureCtx();
    if (!c || !canvasEl.value) return;
    c.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height);
  }

  function drawBackgroundHint() {
    const c = ensureCtx();
    if (!c || !canvasEl.value) return;
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillRect(0, 0, canvasEl.value.width, canvasEl.value.height);
    c.restore();
  }

  function load(next: PathSnapshot[]) {
    pause();
    paths = next.slice().sort((a, b) => a.order - b.order);
    segmentIndex = 0;
    edgeProgress = 0;
    progress.value = 0;
    clear();
    drawBackgroundHint();
  }

  function totalEdges(): number {
    return paths.length * 4; // rectangle perimeter has 4 edges (closing edge drawn)
  }

  function strokePoints(c: CanvasRenderingContext2D, pts: Point[]) {
    c.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
    c.stroke();
  }

  function frame() {
    const c = ensureCtx();
    if (!c || !playing.value) return;

    if (segmentIndex >= paths.length) {
      playing.value = false;
      progress.value = 1;
      return;
    }

    const current = paths[segmentIndex];
    if (!current) {
      playing.value = false;
      progress.value = 1;
      return;
    }

    const points = rectPathToPoints(current.d);
    if (points.length < 2) {
      segmentIndex += 1;
      raf = requestAnimationFrame(frame);
      return;
    }

    // Draw all completed paths fully
    clear();
    drawBackgroundHint();
    c.strokeStyle = '#ff4d4f';
    c.lineWidth = 2;
    c.lineCap = 'round';

    for (let i = 0; i < segmentIndex; i++) {
      const snap = paths[i];
      if (!snap) continue;
      strokePoints(c, rectPathToPoints(snap.d));
    }

    // Animate current path edge-by-edge
    c.beginPath();
    c.moveTo(points[0]!.x, points[0]!.y);
    let remaining = SPEED;
    let edge = Math.floor(edgeProgress);
    let distIntoEdge = edgeProgress - edge;

    // redraw completed edges of current path
    for (let e = 0; e < edge && e < points.length - 1; e++) {
      c.lineTo(points[e + 1]!.x, points[e + 1]!.y);
    }

    if (edge < points.length - 1) {
      const a = points[edge]!;
      const b = points[edge + 1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let t = distIntoEdge + remaining / len;
      if (t >= 1) {
        c.lineTo(b.x, b.y);
        edgeProgress = edge + 1;
        remaining = (t - 1) * len;
        while (remaining > 0 && edgeProgress < points.length - 1) {
          const ea = Math.floor(edgeProgress);
          const pa = points[ea]!;
          const pb = points[ea + 1]!;
          const elen = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
          if (remaining >= elen) {
            c.lineTo(pb.x, pb.y);
            remaining -= elen;
            edgeProgress = ea + 1;
          } else {
            const tt = remaining / elen;
            c.lineTo(pa.x + (pb.x - pa.x) * tt, pa.y + (pb.y - pa.y) * tt);
            edgeProgress = ea + tt;
            remaining = 0;
          }
        }
      } else {
        c.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        edgeProgress = edge + t;
      }
    }
    c.stroke();

    if (edgeProgress >= points.length - 1) {
      segmentIndex += 1;
      edgeProgress = 0;
    }

    const doneEdges = segmentIndex * 4 + Math.min(4, Math.floor(edgeProgress));
    progress.value = Math.min(1, doneEdges / Math.max(1, totalEdges()));

    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (!paths.length) return;
    if (segmentIndex >= paths.length) {
      segmentIndex = 0;
      edgeProgress = 0;
    }
    playing.value = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    playing.value = false;
    cancelAnimationFrame(raf);
  }

  function reset() {
    pause();
    segmentIndex = 0;
    edgeProgress = 0;
    progress.value = 0;
    clear();
    drawBackgroundHint();
  }

  function dispose() {
    pause();
    ctx = null;
    paths = [];
  }

  onBeforeUnmount(dispose);

  return { playing, progress, load, play, pause, reset, clear, dispose };
}
