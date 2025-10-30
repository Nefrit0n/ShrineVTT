import { useEffect, useRef } from "react";

/**
 * SceneCanvas renders the animated backdrop that represents the interactive world.
 * The component is intentionally isolated within the scene feature so that
 * rendering concerns stay decoupled from the higher-level layout and UI logic.
 */
export default function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame: number | null = null;

    const drawBackdrop = () => {
      const dpr = window.devicePixelRatio || 1;
      const { innerWidth, innerHeight } = window;

      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);

      const gradient = context.createLinearGradient(0, 0, innerWidth, innerHeight);
      gradient.addColorStop(0, "#06070d");
      gradient.addColorStop(0.45, "#101425");
      gradient.addColorStop(1, "#05060b");
      context.fillStyle = gradient;
      context.fillRect(0, 0, innerWidth, innerHeight);

      const auraCount = Math.max(6, Math.floor((innerWidth + innerHeight) / 240));
      const now = performance.now();

      for (let index = 0; index < auraCount; index += 1) {
        const progress = (now / 3000 + index * 0.35) % 1;
        const radius = 180 + Math.sin(progress * Math.PI * 2) * 40;
        const x = (innerWidth + 320) * ((index * 37) % 11 / 11) - 160;
        const y = (innerHeight + 260) * ((index * 19) % 13 / 13) - 130;

        context.save();
        context.globalAlpha = 0.12;
        context.filter = "blur(80px)";
        const radial = context.createRadialGradient(x, y, 0, x, y, radius);
        radial.addColorStop(0, index % 2 === 0 ? "#60a5fa" : "#a855f7");
        radial.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = radial;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      animationFrame = window.requestAnimationFrame(drawBackdrop);
    };

    drawBackdrop();

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="workspace-canvas" aria-hidden />;
}
