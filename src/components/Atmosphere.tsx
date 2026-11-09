import { useEffect, useRef } from 'react';
import { cx } from '../lib/util';

/** Layered background: industrial gradient, drifting fog, canvas rain, red emergency light, scanlines, vignette. */
export function Atmosphere({ alarm = 0, intensity = 1 }: { alarm?: number; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const g = canvas.getContext('2d'); if (!g) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Drop = { x: number; y: number; l: number; v: number };
    let drops: Drop[] = [];
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.floor((w * h) / 9000 * intensity);
      drops = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, l: 8 + Math.random() * 18, v: 9 + Math.random() * 10 }));
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(170,185,200,0.22)';
      g.lineWidth = 1;
      g.beginPath();
      for (const d of drops) {
        g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * 0.18, d.y + d.l);
        if (!reduce) { d.y += d.v; d.x -= d.v * 0.18; }
        if (d.y > h) { d.y = -20; d.x = Math.random() * (w + 60); }
      }
      g.stroke();
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [intensity]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1b1f25_0%,#0b0c0f_55%,#050607_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(20,22,26,0.9),transparent)]" />
      <div className="absolute -inset-x-1/4 bottom-0 h-2/3 animate-drift opacity-60 blur-2xl bg-[radial-gradient(ellipse_at_30%_80%,rgba(120,130,140,0.18),transparent_60%),radial-gradient(ellipse_at_75%_90%,rgba(110,115,125,0.16),transparent_55%)]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div
        className={cx('absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,35,42,0.55),transparent_60%)]', alarm > 0 && 'animate-pulseRed')}
        style={{ opacity: alarm > 0 ? undefined : 0.12, animationDuration: alarm > 1 ? '1.1s' : undefined }}
      />
      <div className="scanlines absolute inset-0" />
      <div className="noise absolute inset-0" />
      <div className="vignette absolute inset-0" />
    </div>
  );
}
