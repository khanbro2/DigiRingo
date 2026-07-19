import { useEffect, useRef } from "react";

/**
 * Interactive "pixel ripple" canvas background (inspired by 21st.dev's
 * pixel-perfect-hero, rebuilt in DIGIRINGO's blue/purple identity). A grid of
 * brand-coloured pixels shimmers ambiently, lights up near the pointer, and
 * sends an expanding ripple wave on click. Pauses when off-screen and honours
 * prefers-reduced-motion (renders a faint static grid instead).
 *
 * Renders only the <canvas>; place it as the first child of a position:relative
 * hero with the headline/buttons layered above (higher z-index).
 */
const CELL = 24; // grid spacing in px
const BLUE = [79, 142, 247];
const PURPLE = [155, 111, 247];

export function PixelRipple({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const mouse = { x: -9999, y: -9999 };
    const ripples: { x: number; y: number; t: number }[] = [];
    const start = performance.now();
    let raf = 0;
    let running = false;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) drawStatic();
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h);
      const px = CELL * 0.42;
      for (let cx = CELL / 2; cx < w; cx += CELL) {
        for (let cy = CELL / 2; cy < h; cy += CELL) {
          ctx.fillStyle = "rgba(79,142,247,0.08)";
          ctx.fillRect(cx - px / 2, cy - px / 2, px, px);
        }
      }
    };

    const draw = (now: number) => {
      const time = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      const px = CELL * 0.42;
      let col = 0;
      for (let cx = CELL / 2; cx < w; cx += CELL, col++) {
        let row = 0;
        for (let cy = CELL / 2; cy < h; cy += CELL, row++) {
          // ambient shimmer
          let intensity = 0.05 + 0.045 * Math.sin((col + row) * 0.6 + time * 1.2);

          // pointer proximity glow
          const dx = cx - mouse.x;
          const dy = cy - mouse.y;
          const dist = Math.hypot(dx, dy);
          const R = 150;
          if (dist < R) intensity += (1 - dist / R) * 0.85;

          // click ripples (expanding rings)
          for (const rp of ripples) {
            const age = time - rp.t;
            const radius = age * 340;
            const ring = Math.abs(Math.hypot(cx - rp.x, cy - rp.y) - radius);
            if (ring < 26) intensity += (1 - ring / 26) * Math.max(0, 1 - age / 1.4) * 0.9;
          }

          if (intensity <= 0.045) continue;
          if (intensity > 1) intensity = 1;

          // colour mixes blue→purple across the field + slow time drift
          const mix = (Math.sin(col * 0.16 + time * 0.4) + 1) / 2;
          const r = Math.round(BLUE[0] + (PURPLE[0] - BLUE[0]) * mix);
          const g = Math.round(BLUE[1] + (PURPLE[1] - BLUE[1]) * mix);
          const b = Math.round(BLUE[2] + (PURPLE[2] - BLUE[2]) * mix);
          ctx.fillStyle = `rgba(${r},${g},${b},${(intensity * 0.9).toFixed(3)})`;
          ctx.fillRect(cx - px / 2, cy - px / 2, px, px);
        }
      }

      for (let k = ripples.length - 1; k >= 0; k--) {
        if (time - ripples[k].t > 1.6) ripples.splice(k, 1);
      }

      if (running) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: (performance.now() - start) / 1000 });
    };

    resize();
    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", onLeave);
    parent.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(([entry]) => {
      const vis = entry.isIntersecting;
      if (vis && reduce) {
        drawStatic();
      } else if (vis && !running) {
        running = true;
        raf = requestAnimationFrame(draw);
      } else if (!vis) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
      parent.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", resize);
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    />
  );
}
