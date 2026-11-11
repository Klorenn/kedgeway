"use client";

import { useEffect, useRef } from "react";

const COUNT = 320;
const FRAME_MS = 1000 / 30;

interface Particle {
  x: number;
  y: number;
  vy: number;
  amp: number;
  freq: number;
  phase: number;
}

/** A sparse field of ink dust drifting slowly upward behind the whole page. Off under reduced motion. */
export default function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.style.display = "none";
      return;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let size = 1;
    let raf = 0;
    let last = 0;
    let running = false;
    const particles: Particle[] = [];

    const spawn = (atBottom: boolean): Particle => ({
      x: Math.random() * w,
      y: atBottom ? h + Math.random() * 20 : Math.random() * h,
      vy: 5 + Math.random() * 14,
      amp: 4 + Math.random() * 10,
      freq: 0.15 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
    });

    const resize = (force = false): void => {
      // Ignore height-only changes under 120px (mobile browser toolbars collapsing).
      if (!force && w === window.innerWidth && Math.abs(h - window.innerHeight) < 120) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      size = dpr >= 2 ? 1.5 : 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(COUNT, Math.round((w * h) / 4500));
      while (particles.length < target) particles.push(spawn(false));
      particles.length = target;
    };

    const tick = (now: number): void => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(242, 239, 233, 0.2)";
      const t = now / 1000;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i] as Particle;
        p.y -= p.vy * dt;
        if (p.y < -4) particles[i] = spawn(true);
        ctx.fillRect(p.x + Math.sin(t * p.freq + p.phase) * p.amp, p.y, size, size);
      }
    };

    // Pause the loop entirely while the tab is hidden.
    const onVisibility = (): void => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onResize = (): void => resize();

    resize(true);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}
