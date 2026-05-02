import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface Curtain {
  xBase: number;
  width: number;
  speed: number;
  phaseX: number;
  phaseH: number;
  phaseA: number;
  baseAlpha: number;
}

/**
 * Canvas-based aurora borealis animation for the header.
 * Renders horizontal flowing bands + vertical curtain pillars + stars + mountain silhouettes.
 */
export function AuroraCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const curtainsRef = useRef<Curtain[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    starsRef.current = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.4,
      size: Math.random() * 1 + 0.3,
      twinkleSpeed: Math.random() * 2 + 0.5,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));

    curtainsRef.current = Array.from({ length: 18 }, (_, i) => ({
      xBase: 0.03 + (i / 18) * 0.94 + (Math.random() - 0.5) * 0.03,
      width: 0.025 + Math.random() * 0.04,
      speed: 0.15 + Math.random() * 0.25,
      phaseX: Math.random() * Math.PI * 2,
      phaseH: Math.random() * Math.PI * 2,
      phaseA: Math.random() * Math.PI * 2,
      baseAlpha: 0.15 + Math.random() * 0.2,
    }));

    const animate = () => {
      const dpr = window.devicePixelRatio;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const w = rect.width;
      const h = rect.height;
      timeRef.current += 0.006;
      const time = timeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Sky gradient (colors from CSS custom properties)
      const style = getComputedStyle(canvas);
      const sky1 = style.getPropertyValue('--aurora-sky-1').trim() || '3,10,20';
      const sky2 = style.getPropertyValue('--aurora-sky-2').trim() || '7,24,40';
      const sky3 = style.getPropertyValue('--aurora-sky-3').trim() || '11,37,53';
      const sky4 = style.getPropertyValue('--aurora-sky-4').trim() || '14,30,46';
      const mtn1 = style.getPropertyValue('--aurora-mtn-1').trim() || '8,20,34';
      const mtn2 = style.getPropertyValue('--aurora-mtn-2').trim() || '12,28,48';

      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, `rgb(${sky1})`);
      skyGrad.addColorStop(0.3, `rgb(${sky2})`);
      skyGrad.addColorStop(0.6, `rgb(${sky3})`);
      skyGrad.addColorStop(1, `rgb(${sky4})`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      starsRef.current.forEach((star) => {
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(time * star.twinkleSpeed + star.twinkleOffset));
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });

      // --- HORIZONTAL AURORA BANDS ---
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const drawBand = (
        yCenter: number,
        heightFrac: number,
        colors: [string, string, string],
        speedMul: number,
        phaseOff: number,
        alpha: number
      ) => {
        const segs = 120;
        const topPoints: { x: number; y: number }[] = [];
        const botPoints: { x: number; y: number }[] = [];

        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const x = t * w;
          const wave =
            Math.sin(t * 2.8 + time * 0.4 * speedMul + phaseOff) * 0.08 +
            Math.sin(t * 5.2 + time * 0.25 * speedMul + phaseOff * 1.5) * 0.035 +
            Math.cos(t * 1.5 + time * 0.15 * speedMul) * 0.04;
          const yMid = (yCenter + wave) * h;
          const halfH = heightFrac * h * (0.7 + 0.3 * Math.sin(t * 4 + time * 0.3 + phaseOff));
          topPoints.push({ x, y: yMid - halfH });
          botPoints.push({ x, y: yMid + halfH });
        }

        ctx.beginPath();
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length; i++) {
          ctx.lineTo(topPoints[i].x, topPoints[i].y);
        }
        for (let i = botPoints.length - 1; i >= 0; i--) {
          ctx.lineTo(botPoints[i].x, botPoints[i].y);
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, (yCenter - heightFrac) * h, 0, (yCenter + heightFrac * 1.5) * h);
        grad.addColorStop(0, `rgba(${colors[0]}, 0)`);
        grad.addColorStop(0.2, `rgba(${colors[0]}, ${alpha * 0.5})`);
        grad.addColorStop(0.45, `rgba(${colors[1]}, ${alpha})`);
        grad.addColorStop(0.65, `rgba(${colors[2]}, ${alpha * 0.8})`);
        grad.addColorStop(0.85, `rgba(${colors[2]}, ${alpha * 0.3})`);
        grad.addColorStop(1, `rgba(${colors[2]}, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      };

      // Bands spread across the full height of the bar
      drawBand(0.3, 0.12, ['50,200,160', '70,240,170', '40,180,140'], 1.0, 0, 0.6);
      drawBand(0.45, 0.1, ['60,230,140', '90,255,130', '50,200,100'], 0.8, 1.2, 0.5);
      drawBand(0.55, 0.09, ['40,180,180', '60,210,190', '30,160,150'], 0.7, 2.5, 0.45);
      drawBand(0.65, 0.1, ['150,60,190', '170,80,210', '120,50,160'], 0.6, 4.0, 0.4);
      drawBand(0.2, 0.08, ['50,150,180', '70,200,200', '40,130,160'], 0.9, 0.8, 0.35);

      ctx.restore();

      // --- VERTICAL CURTAIN PILLARS ---
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      curtainsRef.current.forEach((c, i) => {
        const posRatio = c.xBase;
        const swayX = Math.sin(time * c.speed + c.phaseX) * 0.015;
        const cx = (c.xBase + swayX) * w;
        const pillarW = c.width * w;

        const hMul = 0.6 + 0.4 * Math.abs(Math.sin(time * c.speed * 0.7 + c.phaseH));
        // Curtains span most of the bar height
        const topY = h * (0.05 + 0.05 * Math.sin(time * 0.2 + c.phaseH));
        const bottomY = h * (0.7 + 0.25 * hMul);

        const alphaPulse = 0.6 + 0.4 * Math.sin(time * c.speed * 0.9 + c.phaseA);
        const alpha = c.baseAlpha * alphaPulse;

        // Color based on horizontal position
        let r: number, g: number, b: number;
        if (posRatio < 0.3) {
          const t = posRatio / 0.3;
          r = Math.floor(150 - t * 100);
          g = Math.floor(50 + t * 130);
          b = Math.floor(190 - t * 40);
        } else if (posRatio < 0.65) {
          const t = (posRatio - 0.3) / 0.35;
          r = Math.floor(50 - t * 30);
          g = Math.floor(180 + t * 50);
          b = Math.floor(150 + t * 20);
        } else {
          const t = (posRatio - 0.65) / 0.35;
          r = 20;
          g = Math.floor(230 + t * 25);
          b = Math.floor(170 - t * 100);
        }

        // Wide glowing pillar
        const grad = ctx.createLinearGradient(cx, topY, cx, bottomY);
        grad.addColorStop(0, `rgba(${r},${g},${b}, 0)`);
        grad.addColorStop(0.1, `rgba(${r},${g},${b}, ${alpha * 0.4})`);
        grad.addColorStop(0.3, `rgba(${r},${g},${b}, ${alpha * 0.9})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b}, ${alpha})`);
        grad.addColorStop(0.7, `rgba(${r},${g},${b}, ${alpha * 0.7})`);
        grad.addColorStop(0.9, `rgba(${r},${g},${b}, ${alpha * 0.2})`);
        grad.addColorStop(1, `rgba(${r},${g},${b}, 0)`);

        const midSway = Math.sin(time * 0.5 + i * 0.8) * pillarW * 0.15;

        ctx.beginPath();
        ctx.moveTo(cx - pillarW * 0.5, topY);
        ctx.bezierCurveTo(
          cx - pillarW * 0.3 + midSway, topY + (bottomY - topY) * 0.35,
          cx - pillarW * 0.4 - midSway, topY + (bottomY - topY) * 0.65,
          cx - pillarW * 0.35, bottomY
        );
        ctx.lineTo(cx + pillarW * 0.35, bottomY);
        ctx.bezierCurveTo(
          cx + pillarW * 0.4 - midSway, topY + (bottomY - topY) * 0.65,
          cx + pillarW * 0.3 + midSway, topY + (bottomY - topY) * 0.35,
          cx + pillarW * 0.5, topY
        );
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Inner bright core
        const coreW = pillarW * 0.25;
        const coreGrad = ctx.createLinearGradient(cx, topY, cx, bottomY);
        const cr = Math.min(r + 60, 255);
        const cg = Math.min(g + 40, 255);
        const cb = Math.min(b + 30, 255);
        coreGrad.addColorStop(0, `rgba(${cr},${cg},${cb}, 0)`);
        coreGrad.addColorStop(0.25, `rgba(${cr},${cg},${cb}, ${alpha * 0.5})`);
        coreGrad.addColorStop(0.5, `rgba(${cr},${cg},${cb}, ${alpha * 0.6})`);
        coreGrad.addColorStop(0.75, `rgba(${cr},${cg},${cb}, ${alpha * 0.3})`);
        coreGrad.addColorStop(1, `rgba(${cr},${cg},${cb}, 0)`);

        ctx.beginPath();
        ctx.moveTo(cx - coreW * 0.5, topY);
        ctx.bezierCurveTo(
          cx - coreW * 0.3 + midSway * 0.5, topY + (bottomY - topY) * 0.35,
          cx - coreW * 0.4 - midSway * 0.5, topY + (bottomY - topY) * 0.65,
          cx - coreW * 0.35, bottomY
        );
        ctx.lineTo(cx + coreW * 0.35, bottomY);
        ctx.bezierCurveTo(
          cx + coreW * 0.4 - midSway * 0.5, topY + (bottomY - topY) * 0.65,
          cx + coreW * 0.3 + midSway * 0.5, topY + (bottomY - topY) * 0.35,
          cx + coreW * 0.5, topY
        );
        ctx.closePath();
        ctx.fillStyle = coreGrad;
        ctx.fill();
      });

      ctx.restore();

      // --- AMBIENT GLOW ---
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const g1 = ctx.createRadialGradient(w * 0.65, h * 0.3, 0, w * 0.65, h * 0.3, w * 0.45);
      g1.addColorStop(0, `rgba(50,210,130, ${0.08 + 0.03 * Math.sin(time * 0.3)})`);
      g1.addColorStop(0.5, 'rgba(40,180,120, 0.03)');
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(w * 0.18, h * 0.35, 0, w * 0.18, h * 0.35, w * 0.3);
      g2.addColorStop(0, `rgba(150,60,200, ${0.06 + 0.02 * Math.sin(time * 0.25)})`);
      g2.addColorStop(0.5, 'rgba(120,40,170, 0.02)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();

      // --- MOUNTAIN SILHOUETTES (subtle, bottom 15% only) ---
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.88);
      ctx.lineTo(w * 0.05, h * 0.85);
      ctx.lineTo(w * 0.1, h * 0.87);
      ctx.lineTo(w * 0.18, h * 0.82);
      ctx.lineTo(w * 0.25, h * 0.86);
      ctx.lineTo(w * 0.32, h * 0.84);
      ctx.lineTo(w * 0.4, h * 0.87);
      ctx.lineTo(w * 0.48, h * 0.83);
      ctx.lineTo(w * 0.55, h * 0.80);
      ctx.lineTo(w * 0.62, h * 0.85);
      ctx.lineTo(w * 0.7, h * 0.81);
      ctx.lineTo(w * 0.76, h * 0.84);
      ctx.lineTo(w * 0.82, h * 0.86);
      ctx.lineTo(w * 0.88, h * 0.82);
      ctx.lineTo(w * 0.94, h * 0.85);
      ctx.lineTo(w, h * 0.87);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = `rgb(${mtn1})`;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.92);
      ctx.lineTo(w * 0.07, h * 0.89);
      ctx.lineTo(w * 0.15, h * 0.93);
      ctx.lineTo(w * 0.22, h * 0.90);
      ctx.lineTo(w * 0.3, h * 0.94);
      ctx.lineTo(w * 0.38, h * 0.91);
      ctx.lineTo(w * 0.46, h * 0.94);
      ctx.lineTo(w * 0.54, h * 0.90);
      ctx.lineTo(w * 0.62, h * 0.93);
      ctx.lineTo(w * 0.7, h * 0.90);
      ctx.lineTo(w * 0.78, h * 0.94);
      ctx.lineTo(w * 0.86, h * 0.91);
      ctx.lineTo(w * 0.93, h * 0.93);
      ctx.lineTo(w, h * 0.91);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = `rgb(${mtn2})`;
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!motionQuery.matches) {
      animate();
    } else {
      // Single static frame
      timeRef.current = 2;
      animate();
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 w-full h-full block"
      aria-hidden="true"
    />
  );
}
