import React, { useRef, useEffect, useState } from 'react';
import { Eye, EyeOff, Sparkles, ZoomIn, Play, RotateCcw } from 'lucide-react';
import { Language, SimulationParams, TubeData } from '../types';
import { TRANSLATIONS } from '../translations';

interface CylinderCanvasProps {
  language: Language;
  params: SimulationParams;
  tubes: TubeData[];
  cylinderDepthMeters: number; // e.g. 1.0, 2.0, 3.0 m
  zoomScale: number;           // 1.0x, 1.5x, 2.0x
  onChangeZoom: (zoom: number) => void;
  onDropAll: () => void;
  onResetAll: () => void;
  isAnyRunning: boolean;
}

interface Particle {
  tubeIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export const CylinderCanvas: React.FC<CylinderCanvasProps> = ({
  language,
  params,
  tubes,
  cylinderDepthMeters,
  zoomScale,
  onChangeZoom,
  onDropAll,
  onResetAll,
  isAnyRunning,
}) => {
  const t = TRANSLATIONS[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showFBD, setShowFBD] = useState(true);
  const [showStreamlines, setShowStreamlines] = useState(true);

  // Wake particles for vortex eddies
  const wakeParticles = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Background Laboratory Grid
    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const gridSize = 25;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // 3 Tall Flasks Geometry - Substantial cylinders filling roughly 85% of available space
    const totalTubes = tubes.length; // 3
    const sideMargin = Math.max(20, width * 0.04);
    const availableW = width - 2 * sideMargin;
    const tubeSpacing = Math.max(16, availableW * 0.04);
    const tubeWidth = Math.min(168, (availableW - (totalTubes - 1) * tubeSpacing) / totalTubes);

    const tubeTop = 44;
    const tubeBottom = height - 42;
    const tubeHeight = tubeBottom - tubeTop;

    // Heavy Metal Lab Stand Base across all 3 tubes (centered to cylinders)
    const standLeft = sideMargin - 12;
    const standRight = width - sideMargin + 12;
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(standLeft, tubeBottom + 6, standRight - standLeft, 14, 4);
    ctx.fill();
    ctx.restore();

    // Metallic stand bar
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(standLeft + 4, tubeTop - 8, (standRight - standLeft) - 8, 4);

    // Deep high-contrast colors for crystal-clear readable titles
    const deepTitleColors = ['#0369a1', '#15803d', '#c2410c', '#0f766e', '#b91c1c'];

    // Render each of the 3 Flasks
    tubes.forEach((tube, idx) => {
      const centerX = sideMargin + idx * (tubeWidth + tubeSpacing) + tubeWidth / 2;
      const leftX = centerX - tubeWidth / 2;
      const rightX = centerX + tubeWidth / 2;
      const deepColor = deepTitleColors[idx % deepTitleColors.length];

      // Stand Clamps for each tube
      ctx.fillStyle = '#64748b';
      ctx.fillRect(leftX - 6, tubeTop + 14, 6, 10);
      ctx.fillRect(rightX, tubeTop + 14, 6, 10);

      // 1. Fluid Body Fill
      ctx.save();
      const fluidGrad = ctx.createLinearGradient(leftX, 0, rightX, 0);
      fluidGrad.addColorStop(0, tube.fluidRgba);
      fluidGrad.addColorStop(0.3, tube.fluidRgba.replace(/[\d.]+\)$/, '0.42)'));
      fluidGrad.addColorStop(0.7, tube.fluidRgba.replace(/[\d.]+\)$/, '0.38)'));
      fluidGrad.addColorStop(1, tube.fluidRgba.replace(/[\d.]+\)$/, '0.48)'));

      ctx.fillStyle = fluidGrad;
      ctx.beginPath();
      ctx.moveTo(leftX, tubeTop);
      ctx.lineTo(leftX, tubeBottom);
      ctx.arc(centerX, tubeBottom, tubeWidth / 2, Math.PI, 0, true);
      ctx.lineTo(rightX, tubeTop);
      ctx.closePath();
      ctx.fill();

      // 2. Fluid Surface Meniscus
      ctx.beginPath();
      ctx.ellipse(centerX, tubeTop, tubeWidth / 2, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = tube.fluidRgba.replace(/[\d.]+\)$/, '0.65)');
      ctx.fill();
      ctx.strokeStyle = deepColor;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Flask Header Label: Elevated inside a crisp white badge with deep, rich colors
      ctx.save();
      const flaskTitle = `${language === 'bn' ? 'ফ্লাস্ক' : 'Flask'} ${idx + 1}: ${language === 'bn' ? tube.fluidNameBn : tube.fluidNameEn}`;
      const viscText = `η = ${tube.viscosity >= 0.01 ? tube.viscosity.toFixed(3) : tube.viscosity} Pa·s`;

      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      const titleW = ctx.measureText(flaskTitle).width;
      const badgeW = Math.max(titleW + 24, tubeWidth * 0.94);
      const badgeH = 30;
      const badgeX = centerX - badgeW / 2;
      const badgeY = 5;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 1.5;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = deepColor;
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Deep Bold Text for Flask Title
      ctx.fillStyle = deepColor;
      ctx.textAlign = 'center';
      ctx.fillText(flaskTitle, centerX, badgeY + 14);

      // Deep dark slate text for Viscosity (η)
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(viscText, centerX, badgeY + 26);
      ctx.restore();

      // 3. Height Graduations / Ruler Ticks
      const totalDivisions = 10;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
      ctx.fillStyle = '#334155';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';

      for (let i = 0; i <= totalDivisions; i++) {
        const gradY = tubeTop + (tubeHeight * i) / totalDivisions;
        const depthM = (cylinderDepthMeters * (i / totalDivisions)).toFixed(1);

        // Tick mark
        ctx.beginPath();
        ctx.moveTo(leftX, gradY);
        ctx.lineTo(leftX + (i % 5 === 0 ? 9 : 5), gradY);
        ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.6;
        ctx.stroke();

        // Height label on Flask 1 only to keep clean
        if (idx === 0 && (i % 2 === 0)) {
          ctx.fillText(`${depthM}m`, leftX + 11, gradY + 3);
        }
      }

      // 4. Calculate Sphere Position
      // If positionY = 0, sphere rests at the surface (tubeTop)
      const normalizedY = Math.min(1.0, tube.state.positionY / cylinderDepthMeters);
      const sphereVisualY = tubeTop + normalizedY * tubeHeight;

      // Dark High-Contrast Metallic Sphere Size
      const sphereVisualRadius = Math.max(16, Math.min(32, 12 + params.radiusMm * 1.6));

      // 5. Wake & Streamlines
      if (showStreamlines && tube.state.velocity > 0.001) {
        ctx.save();
        const isTurbulent = !tube.state.isLaminar;

        if (isTurbulent) {
          // Vortex wake
          ctx.strokeStyle = 'rgba(220, 38, 38, 0.6)';
          ctx.lineWidth = 1.5;
          for (let k = 0; k < 3; k++) {
            const swirlY = sphereVisualY - (k + 1) * 18;
            if (swirlY > tubeTop) {
              ctx.beginPath();
              const offsetSign = k % 2 === 0 ? 1 : -1;
              ctx.arc(centerX + offsetSign * 10, swirlY, 6 + k * 2, 0, Math.PI * 1.6);
              ctx.stroke();
            }
          }
        } else {
          // Smooth Laminar Streamlines
          ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
          ctx.lineWidth = 1.2;
          [-1.5, 1.5].forEach((factor) => {
            const streamX = centerX + factor * sphereVisualRadius;
            if (streamX > leftX + 6 && streamX < rightX - 6) {
              ctx.beginPath();
              ctx.moveTo(streamX, Math.max(tubeTop, sphereVisualY - 45));
              ctx.quadraticCurveTo(
                streamX + (factor > 0 ? 6 : -6),
                sphereVisualY,
                streamX,
                Math.min(tubeBottom, sphereVisualY + 45)
              );
              ctx.stroke();
            }
          });
        }
        ctx.restore();
      }

      // 6. Balance Lock Glow / Terminal Velocity Ring Flash
      if (tube.state.isTerminalAchieved && tube.state.velocity > 0.01) {
        ctx.save();
        const pulseTime = Date.now() / 250;
        const pulseRadius = sphereVisualRadius + 8 + Math.sin(pulseTime) * 3;

        ctx.beginPath();
        ctx.arc(centerX, sphereVisualY, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#059669'; // High contrast emerald
        ctx.lineWidth = 2.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();

        ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#047857';
        ctx.textAlign = 'center';
        ctx.fillText('vT Reached', centerX, sphereVisualY - sphereVisualRadius - 12);
        ctx.restore();
      }

      // 7. Draw Metallic Sphere (Dark High-Contrast Obsidian Finish)
      ctx.save();
      // Drop shadow
      ctx.beginPath();
      ctx.arc(centerX + 3, sphereVisualY + 4, sphereVisualRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.fill();

      // Radial metallic shading
      const sphereGrad = ctx.createRadialGradient(
        centerX - sphereVisualRadius * 0.35,
        sphereVisualY - sphereVisualRadius * 0.35,
        sphereVisualRadius * 0.08,
        centerX,
        sphereVisualY,
        sphereVisualRadius
      );
      sphereGrad.addColorStop(0, '#ffffff'); // Specular highlight
      sphereGrad.addColorStop(0.2, '#64748b');
      sphereGrad.addColorStop(0.7, '#0f172a'); // Deep dark metallic body
      sphereGrad.addColorStop(1, '#020617'); // Dark rim

      ctx.beginPath();
      ctx.arc(centerX, sphereVisualY, sphereVisualRadius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Outer rim
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      // Center of Mass (C.O.M.) Indicator on Sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, sphereVisualY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15'; // Vibrant amber-yellow ring
      ctx.fill();
      ctx.beginPath();
      ctx.arc(centerX, sphereVisualY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; // White center dot
      ctx.fill();
      ctx.restore();

      // 8. Free Body Diagram (FBD) Vectors with High Visibility & Contrast
      if (showFBD) {
        ctx.save();
        const maxVectorPx = Math.min(75, tubeHeight * 0.24);

        // 1. Weight (W) - Originates DIRECTLY from Center of Mass (centerX, sphereVisualY) pointing downwards
        const lenW = Math.max(36, Math.min(maxVectorPx, 32 + (tube.state.weight / 0.003) * 35));

        // 2. Buoyancy (Fb) - Substantially enlarged for high visibility
        const fbRatio = tube.state.buoyancy / Math.max(0.0001, tube.state.weight);
        const lenFb = Math.max(26, Math.min(maxVectorPx * 0.75, 20 + fbRatio * 38));

        // 3. Stokes Viscous Drag (Fv) - VIOLET color, dynamically growing with velocity
        const fvRatio = Math.min(1.0, tube.state.viscousDrag / Math.max(0.0001, tube.state.weight));
        const lenFv = Math.max(8, Math.min(maxVectorPx * 0.85, 8 + fvRatio * (lenW - 8)));

        // Safe upward clamping so arrows stay below top meniscus
        const maxUpwardPx = Math.max(10, sphereVisualY - (tubeTop - 2));
        const safeFb = Math.min(lenFb, maxUpwardPx);
        const safeFv = Math.min(lenFv, maxUpwardPx);

        // --- A. WEIGHT (W) FROM CENTER OF MASS STRAIGHT DOWN ---
        // High-contrast white halo
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(centerX, sphereVisualY);
        ctx.lineTo(centerX, sphereVisualY + lenW);
        ctx.stroke();

        // Bold Crimson line
        ctx.strokeStyle = '#dc2626';
        ctx.fillStyle = '#dc2626';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(centerX, sphereVisualY);
        ctx.lineTo(centerX, sphereVisualY + lenW);
        ctx.stroke();

        // Arrowhead down
        ctx.beginPath();
        ctx.moveTo(centerX, sphereVisualY + lenW + 6);
        ctx.lineTo(centerX - 5.5, sphereVisualY + lenW - 3);
        ctx.lineTo(centerX + 5.5, sphereVisualY + lenW - 3);
        ctx.closePath();
        ctx.fill();

        // W label badge
        ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(centerX + 4, sphereVisualY + lenW * 0.45 - 6, 32, 13);
        ctx.fillStyle = '#b91c1c';
        ctx.fillText('W=mg', centerX + 6, sphereVisualY + lenW * 0.45 + 4);

        // --- B. BUOYANCY FORCE (Fb) - ENLARGED OCEAN BLUE UPWARD ---
        const fbX = centerX - 13;
        // White halo
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(fbX, sphereVisualY);
        ctx.lineTo(fbX, sphereVisualY - safeFb);
        ctx.stroke();

        // Deep Ocean Blue line
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0284c7';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(fbX, sphereVisualY);
        ctx.lineTo(fbX, sphereVisualY - safeFb);
        ctx.stroke();

        // Arrowhead up
        ctx.beginPath();
        ctx.moveTo(fbX, sphereVisualY - safeFb - 6);
        ctx.lineTo(fbX - 5, sphereVisualY - safeFb + 3);
        ctx.lineTo(fbX + 5, sphereVisualY - safeFb + 3);
        ctx.closePath();
        ctx.fill();

        // Fb label badge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(fbX - 22, sphereVisualY - safeFb * 0.5 - 6, 18, 13);
        ctx.fillStyle = '#0369a1';
        ctx.fillText('Fb ↑', fbX - 20, sphereVisualY - safeFb * 0.5 + 4);

        // --- C. STOKES DRAG (Fv) - VIBRANT VIOLET UPWARD ---
        const fvX = centerX + 13;
        // White halo
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(fvX, sphereVisualY);
        ctx.lineTo(fvX, sphereVisualY - safeFv);
        ctx.stroke();

        // Vibrant Violet line
        ctx.strokeStyle = '#7c3aed';
        ctx.fillStyle = '#7c3aed';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(fvX, sphereVisualY);
        ctx.lineTo(fvX, sphereVisualY - safeFv);
        ctx.stroke();

        // Arrowhead up
        ctx.beginPath();
        ctx.moveTo(fvX, sphereVisualY - safeFv - 6);
        ctx.lineTo(fvX - 5, sphereVisualY - safeFv + 3);
        ctx.lineTo(fvX + 5, sphereVisualY - safeFv + 3);
        ctx.closePath();
        ctx.fill();

        // Fv label badge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(fvX + 5, sphereVisualY - safeFv * 0.5 - 6, 18, 13);
        ctx.fillStyle = '#6d28d9';
        ctx.fillText('Fv ↑', fvX + 7, sphereVisualY - safeFv * 0.5 + 4);

        ctx.restore();
      }

      // 9. Glass Cylinder Outer Walls & Glare Reflections
      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(leftX, tubeTop);
      ctx.lineTo(leftX, tubeBottom);
      ctx.arc(centerX, tubeBottom, tubeWidth / 2, Math.PI, 0, true);
      ctx.lineTo(rightX, tubeTop);
      ctx.stroke();

      // Glare highlight
      const glare = ctx.createLinearGradient(leftX, 0, leftX + 16, 0);
      glare.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
      glare.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glare;
      ctx.fillRect(leftX + 2, tubeTop, 14, tubeHeight);
      ctx.restore();

      // Bottom Digital Readout for each flask
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(`v: ${tube.state.velocity.toFixed(3)} m/s`, centerX, tubeBottom + 21);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`vT: ${tube.state.terminalVelocity.toFixed(3)} m/s`, centerX, tubeBottom + 33);
    });

    // 10. Reached Bottom State Note
    const allBottom = tubes.every((t) => t.state.hasReachedBottom);
    if (allBottom) {
      ctx.save();
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#047857';
      ctx.textAlign = 'center';
      ctx.fillText(
        language === 'bn' ? '✓ সকল গোলক স্তম্ভের নিচে পৌঁছেছে · পুনরায় ড্রপ করুন' : '✓ All spheres reached bottom · Ready to Reset or Drop',
        width / 2,
        height - 6
      );
      ctx.restore();
    }
  }, [
    tubes,
    params,
    cylinderDepthMeters,
    zoomScale,
    showFBD,
    showStreamlines,
    language,
  ]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-w-[340px] bg-slate-50 border-r border-sky-200/80 p-3 sm:p-4 relative overflow-hidden"
    >
      {/* Stage Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 bg-white/95 backdrop-blur px-3 py-2 rounded-xl border border-sky-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t.cylinderTitle}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {cylinderDepthMeters.toFixed(1)}m Column
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom / Height Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-600 font-semibold px-1 flex items-center gap-0.5">
              <ZoomIn className="w-3 h-3 text-slate-500" />
              <span>{language === 'bn' ? 'দৈর্ঘ্য' : 'Depth'}:</span>
            </span>
            {[1.0, 1.5, 2.0].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChangeZoom(d)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  cylinderDepthMeters === d
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d.toFixed(1)}m
              </button>
            ))}
          </div>

          {/* Toggle FBD */}
          <button
            type="button"
            onClick={() => setShowFBD(!showFBD)}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
              showFBD
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
            title="Toggle Free Body Diagram Vectors"
          >
            {showFBD ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>FBD</span>
          </button>

          {/* Toggle Streamlines */}
          <button
            type="button"
            onClick={() => setShowStreamlines(!showStreamlines)}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
              showStreamlines
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
            title="Toggle Streamlines"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Flow</span>
          </button>
        </div>
      </div>

      {/* Center Canvas Area with 3 Tall Cylinders (Starts right below toolbar, zero dead space) */}
      <div className="flex-1 w-full relative flex flex-col items-stretch justify-start min-h-[540px]">
        <canvas
          ref={canvasRef}
          className="w-full flex-1 min-h-[540px] rounded-xl bg-gradient-to-b from-sky-50/40 via-white to-sky-50/20 border border-sky-100 shadow-inner block"
        />
      </div>

      {/* Bottom Bar: Comparison Note & Deep Vector Key Underneath the 3 Flasks */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200/80 bg-white/90 backdrop-blur-sm rounded-xl px-3.5 py-2 shadow-2xs">
        <div className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{t.compareNote}</span>
        </div>

        {/* Deep Vector Key (Now positioned below the 3 flasks) */}
        {showFBD && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-bold">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">
              {language === 'bn' ? 'ভেক্টর নির্দেশিকা:' : 'Vector Key:'}
            </span>
            <div className="flex items-center gap-1.5 text-red-700 font-bold bg-red-50/90 px-2 py-0.5 rounded border border-red-200">
              <span className="w-2.5 h-1 bg-red-700 rounded-full" />
              <span>Weight: W = mg ↓ ({language === 'bn' ? 'ভরকেন্দ্র' : 'C.O.M.'})</span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-700 font-bold bg-sky-50/90 px-2 py-0.5 rounded border border-sky-200">
              <span className="w-2.5 h-1 bg-sky-700 rounded-full" />
              <span>Buoyancy: Fb = σVg ↑</span>
            </div>
            <div className="flex items-center gap-1.5 text-violet-700 font-bold bg-violet-50/90 px-2 py-0.5 rounded border border-violet-200">
              <span className="w-2.5 h-1 bg-violet-700 rounded-full" />
              <span>Stokes Drag: Fv = 6πηrv ↑ ({language === 'bn' ? 'বেগুনি' : 'Violet'})</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
