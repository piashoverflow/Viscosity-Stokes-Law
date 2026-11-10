import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Layers, ArrowLeft, Activity, Waves, MoveHorizontal, Gauge } from 'lucide-react';
import { Language, ViscosityShearParams } from '../types';
import { computeNewtonViscousDrag } from '../physics';
import { TRANSLATIONS } from '../translations';

interface NewtonViscosityCanvasProps {
  language: Language;
}

interface FluidTracer {
  x: number;
  yNorm: number; // 0 (bottom) to 1 (top)
  size: number;
}

export const NewtonViscosityCanvas: React.FC<NewtonViscosityCanvasProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initial parameters: compact initial object (plateArea: 0.04 m²), deeper fluid (fluidDepthMm: 65 mm)
  const [params, setParams] = useState<ViscosityShearParams>({
    plateVelocity: 1.5,    // m/s
    plateArea: 0.04,       // m^2 (compact initial size, can be expanded to 0.25 m^2!)
    fluidDepthMm: 65,      // 65 mm (up to 150 mm deep liquid!)
    fluidViscosity: 0.35,  // Pa·s
    isRunning: true,
  });

  // Plate position and drag interaction state
  const plateXRef = useRef<number>(100);
  const isDraggingRef = useRef<boolean>(false);
  const dragLastXRef = useRef<number>(0);
  const dragLastTimeRef = useRef<number>(0);
  const dragVelocityRef = useRef<number>(0);
  const [isDraggingState, setIsDraggingState] = useState<boolean>(false);

  const tracersRef = useRef<FluidTracer[]>([]);

  // Seed fluid tracers
  useEffect(() => {
    const tracers: FluidTracer[] = [];
    const count = 100;
    for (let i = 0; i < count; i++) {
      tracers.push({
        x: Math.random() * 880,
        yNorm: Math.random(),
        size: 1.8 + Math.random() * 2.2,
      });
    }
    tracersRef.current = tracers;
  }, []);

  // Live calculations (using drag velocity if actively dragging, else plateVelocity)
  const fluidDepthMeters = params.fluidDepthMm * 1e-3;
  const activeEffectiveSpeed = isDraggingState
    ? Math.max(0.2, Math.abs(dragVelocityRef.current))
    : params.plateVelocity;

  const { velocityGradient, shearStress, dragForce } = computeNewtonViscousDrag(
    activeEffectiveSpeed,
    params.plateArea,
    fluidDepthMeters,
    params.fluidViscosity
  );

  // Sync params to ref
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Pointer drag event handlers for interactive object manipulation
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = rect.width;
    const minW = 95;
    const maxW = Math.min(360, width * 0.55);
    const plateWidth = minW + ((params.plateArea - 0.01) / (0.25 - 0.01)) * (maxW - minW);
    const topPlateY = 60;
    const plateH = 34;

    const currentPx = plateXRef.current;

    // Check if clicked inside or near the plate
    if (
      clickX >= currentPx - 15 &&
      clickX <= currentPx + plateWidth + 15 &&
      clickY >= topPlateY - 15 &&
      clickY <= topPlateY + plateH + 20
    ) {
      isDraggingRef.current = true;
      setIsDraggingState(true);
      dragLastXRef.current = clickX;
      dragLastTimeRef.current = performance.now();
      dragVelocityRef.current = 0;
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const now = performance.now();
    const dt = Math.max(0.008, (now - dragLastTimeRef.current) / 1000);

    const deltaX = currentX - dragLastXRef.current;
    plateXRef.current += deltaX;

    // Estimate drag velocity
    const speed = (deltaX / dt) * 0.012;
    dragVelocityRef.current = speed;

    dragLastXRef.current = currentX;
    dragLastTimeRef.current = now;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDraggingState(false);
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  // Main animation loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;
      const p = paramsRef.current;

      const canvas = canvasRef.current;
      const width = canvas ? canvas.getBoundingClientRect().width : 700;
      const marginX = 35;
      const minW = 95;
      const maxW = Math.min(360, width * 0.55);
      const plateWidth = minW + ((p.plateArea - 0.01) / (0.25 - 0.01)) * (maxW - minW);

      // Automatic cruising when not dragging and isRunning is true
      if (p.isRunning && !isDraggingRef.current) {
        plateXRef.current += p.plateVelocity * 65 * dt;
        if (plateXRef.current > width - marginX - plateWidth) {
          plateXRef.current = marginX + 10;
        }
      }

      // Constrain plate within bounds
      if (plateXRef.current < marginX) plateXRef.current = marginX;
      if (plateXRef.current > width - marginX - plateWidth) {
        plateXRef.current = width - marginX - plateWidth;
      }

      // Move tracers with shear velocity gradient
      const effectiveVelocity = isDraggingRef.current
        ? Math.max(0.5, Math.abs(dragVelocityRef.current))
        : p.isRunning
        ? p.plateVelocity
        : 0;

      tracersRef.current.forEach((tr) => {
        const speedPx = tr.yNorm * effectiveVelocity * 70;
        tr.x += speedPx * dt;
        if (tr.x > width - marginX) {
          tr.x = marginX;
          tr.yNorm = Math.random();
        }
      });

      draw();
      animId = requestAnimationFrame(loop);
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const p = paramsRef.current;

      // Coordinates & Dynamic Deep Fluid Geometry
      const marginX = 35;
      const topPlateY = 60;
      const plateH = 34;
      const fluidTopY = topPlateY + plateH;

      // Deep fluid height scaling: fluidDepthMm from 10 to 150 mm
      const minFluidVisualH = 140;
      const maxFluidVisualH = Math.min(310, height - fluidTopY - 45);
      const fluidH = minFluidVisualH + ((p.fluidDepthMm - 10) / (150 - 10)) * (maxFluidVisualH - minFluidVisualH);
      const bottomPlateY = fluidTopY + fluidH;

      // Dynamic plate width scaling based on plate contact area A
      const minPlateW = 95;
      const maxPlateW = Math.min(360, width * 0.55);
      const plateWidth = minPlateW + ((p.plateArea - 0.01) / (0.25 - 0.01)) * (maxPlateW - minPlateW);
      const plateX = plateXRef.current;

      // 1. Fluid Tank Fill with Viscous Depth Gradient
      const fluidGrad = ctx.createLinearGradient(0, fluidTopY, 0, bottomPlateY);
      fluidGrad.addColorStop(0, 'rgba(14, 165, 233, 0.45)');   // Agitated surface layer
      fluidGrad.addColorStop(0.35, 'rgba(14, 165, 233, 0.32)');
      fluidGrad.addColorStop(0.7, 'rgba(14, 165, 233, 0.22)');
      fluidGrad.addColorStop(1, 'rgba(14, 165, 233, 0.12)');   // Stationary boundary layer
      ctx.fillStyle = fluidGrad;
      ctx.fillRect(marginX, fluidTopY, width - 2 * marginX, fluidH);

      // Tank Outer Outline
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(marginX, fluidTopY, width - 2 * marginX, fluidH);

      // 2. Horizontal Fluid Layer Shear Streamlines throughout Deep Fluid
      const layerCount = 9;
      for (let i = 0; i <= layerCount; i++) {
        const ly = fluidTopY + (fluidH * i) / layerCount;
        const normY = 1 - i / layerCount; // 1 at top surface, 0 at bottom
        ctx.strokeStyle = `rgba(14, 165, 233, ${0.16 + normY * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(marginX, ly);
        ctx.lineTo(width - marginX, ly);
        ctx.stroke();

        // Shear velocity vectors showing dv/dy
        const vectorCount = 6;
        for (let v = 1; v <= vectorCount; v++) {
          const vx = marginX + (v * (width - 2 * marginX)) / (vectorCount + 1);
          const arrowLen = normY * p.plateVelocity * 42;

          if (arrowLen > 2) {
            ctx.strokeStyle = '#0284c7'; // Deep Ocean Cyan
            ctx.fillStyle = '#0284c7';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(vx, ly);
            ctx.lineTo(vx + arrowLen, ly);
            ctx.stroke();

            // Arrowhead
            ctx.beginPath();
            ctx.moveTo(vx + arrowLen, ly);
            ctx.lineTo(vx + arrowLen - 4, ly - 2.5);
            ctx.lineTo(vx + arrowLen - 4, ly + 2.5);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // 3. Fluid Tracers
      tracersRef.current.forEach((tr) => {
        const py = bottomPlateY - tr.yNorm * fluidH;
        if (tr.x >= marginX && tr.x <= width - marginX) {
          ctx.beginPath();
          ctx.arc(tr.x, py, tr.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(2, 132, 199, ${0.28 + tr.yNorm * 0.55})`;
          ctx.fill();
        }
      });

      // 4. Stationary Bottom Solid Boundary (No-Slip: v = 0)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(marginX - 6, bottomPlateY, width - 2 * marginX + 12, 24);

      // Boundary Hatching
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      for (let hx = marginX; hx < width - marginX + 10; hx += 16) {
        ctx.beginPath();
        ctx.moveTo(hx, bottomPlateY + 24);
        ctx.lineTo(hx + 10, bottomPlateY);
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        language === 'bn' ? 'স্থির তল (Fixed Base): v = 0 m/s (No-Slip Condition)' : 'Stationary Boundary (No-Slip): v = 0 m/s',
        marginX + 15,
        bottomPlateY + 16
      );

      // 5. Moving Upper Object / Surface Plate (Scales with Area A, Draggable!)
      const plateGrad = ctx.createLinearGradient(plateX, topPlateY, plateX, topPlateY + plateH);
      plateGrad.addColorStop(0, isDraggingRef.current ? '#334155' : '#475569');
      plateGrad.addColorStop(0.5, '#1e293b');
      plateGrad.addColorStop(1, '#020617');
      ctx.fillStyle = plateGrad;
      ctx.beginPath();
      ctx.roundRect(plateX, topPlateY, plateWidth, plateH, 6);
      ctx.fill();
      ctx.strokeStyle = isDraggingRef.current ? '#38bdf8' : '#94a3b8';
      ctx.lineWidth = isDraggingRef.current ? 3 : 2;
      ctx.stroke();

      // Grip Handle Ribs on the Object
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      const stepRib = Math.max(14, plateWidth / 8);
      for (let g = plateX + 16; g < plateX + plateWidth - 14; g += stepRib) {
        ctx.beginPath();
        ctx.moveTo(g, topPlateY + 6);
        ctx.lineTo(g, topPlateY + plateH - 6);
        ctx.stroke();
      }

      // Drag Hint Badge over Object
      ctx.save();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        language === 'bn'
          ? `চলমান বস্তু (Contact Area A = ${p.plateArea.toFixed(2)} m²)`
          : `Moving Object (Area A = ${p.plateArea.toFixed(2)} m²)`,
        plateX + plateWidth / 2,
        topPlateY + 21
      );
      ctx.restore();

      // 6. Vector 1: Forward Motion Velocity Vector v_plate (Deep Indigo Blue Arrow)
      const vArrowStartX = plateX + plateWidth + 8;
      const vArrowLen = Math.min(100, Math.max(25, p.plateVelocity * 40));
      ctx.strokeStyle = '#1d4ed8'; // Deep Indigo Blue
      ctx.fillStyle = '#1d4ed8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(vArrowStartX, topPlateY + plateH / 2);
      ctx.lineTo(vArrowStartX + vArrowLen, topPlateY + plateH / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(vArrowStartX + vArrowLen + 6, topPlateY + plateH / 2);
      ctx.lineTo(vArrowStartX + vArrowLen - 4, topPlateY + plateH / 2 - 5);
      ctx.lineTo(vArrowStartX + vArrowLen - 4, topPlateY + plateH / 2 + 5);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`v = ${p.plateVelocity.toFixed(2)} m/s →`, vArrowStartX + vArrowLen + 8, topPlateY + plateH / 2 + 4);

      // 7. Vector 2: Backward Retarding Viscous Drag Force F (Deep Crimson Red Arrow)
      const dragArrowStartX = plateX - 8;
      const dragArrowLen = Math.min(130, Math.max(28, dragForce * 220));
      ctx.strokeStyle = '#b91c1c'; // Deep Crimson Red
      ctx.fillStyle = '#b91c1c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(dragArrowStartX, topPlateY + plateH / 2);
      ctx.lineTo(dragArrowStartX - dragArrowLen, topPlateY + plateH / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(dragArrowStartX - dragArrowLen - 6, topPlateY + plateH / 2);
      ctx.lineTo(dragArrowStartX - dragArrowLen + 5, topPlateY + plateH / 2 - 5.5);
      ctx.lineTo(dragArrowStartX - dragArrowLen + 5, topPlateY + plateH / 2 + 5.5);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        `← ${t.dragForceLabel}: ${(dragForce * 1000).toFixed(1)} mN`,
        dragArrowStartX - dragArrowLen - 8,
        topPlateY + plateH / 2 + 4
      );

      // 8. Velocity Gradient Triangular Profile Indicator (dv/dy)
      const profX = marginX + 35;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(profX, bottomPlateY);
      ctx.lineTo(profX + Math.min(90, p.plateVelocity * 45), fluidTopY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 9. Vertical Depth Ruler (h)
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      const depthX = width - marginX - 25;
      ctx.beginPath();
      ctx.moveTo(depthX, fluidTopY);
      ctx.lineTo(depthX, bottomPlateY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(depthX - 5, fluidTopY);
      ctx.lineTo(depthX + 5, fluidTopY);
      ctx.moveTo(depthX - 5, bottomPlateY);
      ctx.lineTo(depthX + 5, bottomPlateY);
      ctx.stroke();

      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.fillText(`h = ${p.fluidDepthMm} mm`, depthX + 8, fluidTopY + fluidH / 2 + 4);

      // 10. Interactive Drag Callout Hint
      ctx.save();
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(
        language === 'bn'
          ? '💡 মাউস দিয়ে বস্তুটি টেনে সরিয়ে সান্দ্র তরলের বাধাদানকারী বল পরীক্ষা করতে পারেন'
          : '💡 Click and drag the object across the fluid to feel the resisting viscous drag force',
        width / 2,
        topPlateY - 14
      );
      ctx.restore();

      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [params, language, dragForce, t.dragForceLabel]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header Info */}
      <div className="bg-white border border-sky-200 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Waves className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {t.newtonTitle}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {t.newtonSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setParams((p) => ({ ...p, isRunning: !p.isRunning }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                params.isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {params.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{params.isRunning ? t.pause : t.resume}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setParams({
                  plateVelocity: 1.5,
                  plateArea: 0.04,
                  fluidDepthMm: 65,
                  fluidViscosity: 0.35,
                  isRunning: true,
                });
                plateXRef.current = 100;
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.reset}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Split: LEFT Side Control Panel + RIGHT Side Canvas Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        {/* Left Column: Control Panel with Green Sliders */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Sliders */}
          <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>{t.controlsTitle}</span>
            </div>

            {/* Plate Speed (GREEN SLIDER) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700">{t.plateSpeedLabel}:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                  {params.plateVelocity.toFixed(2)} m/s
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="4.0"
                step="0.1"
                value={params.plateVelocity}
                onChange={(e) => setParams((p) => ({ ...p, plateVelocity: parseFloat(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Plate Contact Area (GREEN SLIDER) - Now dynamically resizes object! */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700">{t.plateAreaLabel}:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                  {params.plateArea.toFixed(2)} m²
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.25"
                step="0.005"
                value={params.plateArea}
                onChange={(e) => setParams((p) => ({ ...p, plateArea: parseFloat(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>0.01 m² (Compact)</span>
                <span>0.25 m² (Broad)</span>
              </div>
            </div>

            {/* Fluid Layer Depth h (GREEN SLIDER) - Increased range up to 150 mm! */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700">{t.fluidDepthLabel}:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                  {params.fluidDepthMm} mm
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="1"
                value={params.fluidDepthMm}
                onChange={(e) => setParams((p) => ({ ...p, fluidDepthMm: parseInt(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>10 mm (Steep gradient)</span>
                <span>150 mm (Deep fluid)</span>
              </div>
            </div>

            {/* Viscosity (GREEN SLIDER) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700">{t.viscosityLabel}:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                  {params.fluidViscosity.toFixed(3)} Pa·s
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="2.0"
                step="0.02"
                value={params.fluidViscosity}
                onChange={(e) => setParams((p) => ({ ...p, fluidViscosity: parseFloat(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Quantitative Outputs Card */}
          <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>{language === 'bn' ? 'নিউটনের সান্দ্র বল হিসাব' : 'Newtonian Viscous Calculations'}</span>
            </div>

            {/* Retarding Drag Force */}
            <div className="bg-red-50/70 border border-red-200 rounded-lg p-2.5">
              <div className="text-[11px] font-bold text-red-800 flex items-center justify-between">
                <span>{t.dragForceLabel} (F):</span>
                <ArrowLeft className="w-3.5 h-3.5 text-red-700" />
              </div>
              <div className="text-lg font-mono font-bold text-red-950 mt-0.5">
                {(dragForce * 1000).toFixed(2)}{' '}
                <span className="text-xs font-normal text-red-700">mN</span>
              </div>
              <div className="text-[10px] text-red-700 font-mono mt-0.5">
                F = η × A × (dv/dy)
              </div>
            </div>

            {/* Velocity Gradient */}
            <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-2.5">
              <div className="text-[11px] font-bold text-sky-800">
                {t.velocityGradientLabel} (dv/dy):
              </div>
              <div className="text-base font-mono font-bold text-sky-950 mt-0.5">
                {velocityGradient.toFixed(1)}{' '}
                <span className="text-xs font-normal text-sky-700">s⁻¹</span>
              </div>
            </div>

            {/* Shear Stress */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <div className="text-[11px] font-bold text-slate-700">
                {t.shearStressLabel}:
              </div>
              <div className="text-base font-mono font-bold text-slate-900 mt-0.5">
                {shearStress.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-600">Pa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Canvas Display (Spans 3 cols on desktop) */}
        <div className="lg:col-span-3 bg-white border border-sky-200 rounded-xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`w-full h-[440px] sm:h-[500px] rounded-lg bg-gradient-to-b from-sky-50/30 to-slate-50 border border-slate-100 touch-none ${
              isDraggingState ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          />
          <div className="mt-2 text-xs text-slate-600 text-center font-bold">
            {t.couetteDescription}
          </div>
        </div>
      </div>
    </div>
  );
};
