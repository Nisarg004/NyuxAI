"use client";

import { useEffect, useRef } from "react";

/**
 * The Wire: every stroke is a story. A cloud of them turns slowly in 3D, then ten
 * lines pull out of the noise and settle into a stack — the brief. The pointer
 * tilts the whole scene. One orchestrated moment on load, then it only drifts.
 *
 * Plain 2D canvas with a hand-rolled perspective projection: no 3D library, ~1k
 * particles, paused whenever it is off-screen or the tab is hidden.
 */

type Particle = {
  // Home in the cloud, unit-ish ellipsoid.
  cx: number;
  cy: number;
  cz: number;
  phase: number;
  len: number;
  // Brief target (only for selected particles), in sheet units.
  row: number; // -1 = stays in the cloud
  tx: number;
  tw: number;
  delay: number;
};

const ROWS = 10;
const ASSEMBLE_AT = 1.4; // seconds before the brief starts to form
const ASSEMBLE_FOR = 2.6;

const NIGHT_HAZE = [158, 163, 214];
const STAR = [236, 238, 255];
const DAWN = [255, 190, 138];
const AURORA = [140, 123, 255];

function rand(seed: number) {
  // Deterministic so the server-free first frame is the same on every load.
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildParticles(count: number): Particle[] {
  const r = rand(7);
  const particles: Particle[] = [];

  // Lay out the brief first: ten rows of word-chunks with ragged right edges.
  const chunks: { row: number; x: number; w: number }[] = [];
  for (let row = 0; row < ROWS; row++) {
    const isHeadline = row === 0;
    const width = isHeadline ? 0.82 : 0.55 + r() * 0.4;
    let x = 0;
    while (x < width) {
      const w = (isHeadline ? 0.06 : 0.035) + r() * 0.07;
      if (x + w > width) break;
      chunks.push({ row, x, w });
      x += w + 0.018;
    }
  }

  // Hand each brief chunk to a random particle, so the lines are drawn from all over the globe.
  const owner = new Map<number, (typeof chunks)[number]>();
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  chunks.forEach((chunk, i) => owner.set(order[i], chunk));

  // The cloud is a globe: points spread evenly over a sphere (a Fibonacci lattice),
  // so it reads as one solid object turning, not as static.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const phi = i * golden;
    const lift = 1 + (r() - 0.5) * 0.04;
    const chunk = owner.get(i);
    particles.push({
      cx: Math.cos(phi) * ring * lift,
      cy: y * lift,
      cz: Math.sin(phi) * ring * lift,
      phase: r() * Math.PI * 2,
      len: 3 + r() * 7,
      row: chunk ? chunk.row : -1,
      tx: chunk ? chunk.x : 0,
      tw: chunk ? chunk.w : 0,
      delay: chunk ? chunk.row * 0.12 + r() * 0.35 : 0,
    });
  }
  return particles;
}

function mix(a: number[], b: number[], t: number) {
  return `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`;
}

export function WireCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let raf = 0;
    let running = false;
    let start = performance.now();
    let last = start;
    let angle = 0.6;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const count = width < 768 ? 520 : 1100;
      if (particles.length !== count) particles = buildParticles(count);
      if (reduced || !running) draw(reduced ? 1e6 : (last - start) / 1000);
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const mobile = width < 768;
      const cx = mobile ? width * 0.5 : width * 0.755;
      const cy = mobile ? height * 0.24 : height * 0.52;
      const scale = mobile ? Math.min(width * 0.36, height * 0.17) : Math.min(width * 0.2, height * 0.34);
      const focal = 3.2;

      // The brief sheet: a plane facing the viewer, tilted by the pointer.
      const sheetW = scale * (mobile ? 1.9 : 1.6);
      const rowGap = scale * (mobile ? 0.15 : 0.135);
      const sheetH = rowGap * (ROWS - 1);
      const tiltX = pointer.y * 0.25;
      const tiltY = pointer.x * 0.35;

      const progress = reduced ? 1 : Math.min(1, Math.max(0, (t - ASSEMBLE_AT) / ASSEMBLE_FOR));
      const settled = easeInOut(progress);

      // The sheet's glow arrives with the lines.
      if (settled > 0.01) {
        const pad = scale * 0.16;
        const x0 = cx - sheetW / 2 - pad + tiltY * 18;
        const y0 = cy - sheetH / 2 - pad - tiltX * 18;
        ctx.save();
        ctx.globalAlpha = settled;
        const g = ctx.createLinearGradient(x0, y0, x0 + sheetW, y0 + sheetH);
        g.addColorStop(0, "rgba(247,247,252,0.10)");
        g.addColorStop(1, "rgba(140,123,255,0.06)");
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(236,238,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x0, y0, sheetW + pad * 2, sheetH + pad * 2, 22);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const cosA = Math.cos(angle + tiltY);
      const sinA = Math.sin(angle + tiltY);
      const cosB = Math.cos(0.32 + tiltX);
      const sinB = Math.sin(0.32 + tiltX);

      for (const p of particles) {
        // Drift: each story wanders a little around its home.
        const dx = Math.sin(t * 0.35 + p.phase) * 0.012;
        const dy = Math.cos(t * 0.29 + p.phase * 1.3) * 0.012;
        let x = p.cx + dx;
        let y = p.cy + dy;
        let z = p.cz;
        // Turn around Y, then tip around X.
        const x1 = x * cosA - z * sinA;
        const z1 = x * sinA + z * cosA;
        const y1 = y * cosB - z1 * sinB;
        const z2 = y * sinB + z1 * cosB;
        x = x1;
        y = y1;
        z = z2;
        const persp = focal / (focal + z);
        const sx = cx + x * scale * persp;
        const sy = cy + y * scale * persp;
        const depth = (1 - z) / 2; // 0 far, 1 near

        if (p.row < 0) {
          const alpha = (0.08 + depth * 0.62) * (1 - settled * 0.45);
          ctx.fillStyle = `rgba(${mix(NIGHT_HAZE, AURORA, 1 - depth)},${alpha})`;
          ctx.fillRect(sx, sy, p.len * persp, Math.max(1, 1.4 * persp));
          continue;
        }

        const local = reduced ? 1 : easeInOut(Math.min(1, Math.max(0, (t - ASSEMBLE_AT - p.delay) / ASSEMBLE_FOR)));
        const bx = cx - sheetW / 2 + p.tx * sheetW + tiltY * 18;
        const by = cy - sheetH / 2 + p.row * rowGap - tiltX * 18;
        const px = sx + (bx - sx) * local;
        const py = sy + (by - sy) * local;
        const w = p.len * persp + (p.tw * sheetW - p.len * persp) * local;
        const isHeadline = p.row === 0;
        const h = Math.max(1, 1.4 * persp + ((isHeadline ? 7 : 4.5) - 1.4 * persp) * local);
        const color = isHeadline ? mix(STAR, DAWN, local) : mix(NIGHT_HAZE, STAR, local);
        const alpha = 0.35 + depth * 0.4 + local * (isHeadline ? 0.6 : 0.35);
        ctx.fillStyle = `rgba(${color},${Math.min(1, alpha)})`;
        ctx.beginPath();
        ctx.roundRect(px, py - h / 2, Math.max(1, w), h, h / 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      angle += dt * 0.12;
      draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      if (running || reduced) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()));
    const onVisibility = () => (document.hidden ? pause() : play());

    resize();
    start = performance.now();
    last = start;
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    observer.observe(canvas);

    return () => {
      pause();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
