import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Rocket, ToggleLeft, ToggleRight, Target, Compass, Gauge, ZoomIn } from 'lucide-react';
import { Language, HorizontalStokesParams } from '../types';
import { computeHorizontalStokesTrajectory } from '../physics';
import { TRANSLATIONS } from '../translations';

interface HorizontalStokesCanvasProps {
  language: Language;
}

interface TrajectoryPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const HorizontalStokesCanvas: React.FC<HorizontalStokesCanvasProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Default isRunning is FALSE so the object does NOT drop/launch by default!
  const [params, setParams] = useState<HorizontalStokesParams>({
    initialSpeed: 4.5,     // m/s
    hasGravity: true,      // toggle: with vs without gravity
    radiusMm: 6.0,         // mm
    sphereDensity: 7850,   // Steel (kg/m^3)
    fluidViscosity: 0.12,  // Pa·s
    fluidDensity: 960,     // kg/m^3
    timeSpeed: 0.5,        // 0.5x Slow-Mo by default for clear observation
    isRunning: false,      // User clicks Launch to start!
  });

  const [tankZoom, setTankZoom] = useState<number>(1.5); // 1.0x (2.2m), 1.5x (3.3m), 2.0x (4.4m extended flight!)

  // Ball physics state in Ref
  const ballRef = useRef({
    x: 0,
    y: 0,
    vx: 4.5,
    vy: 0,
    time: 0,
    hasStopped: false,
  });

  const trailRef = useRef<TrajectoryPoint[]>([]);

  // Telemetry for UI readouts
  const [telemetry, setTelemetry] = useState({
    speed: 4.5,
    vx: 4.5,
    vy: 0,
    time: 0,
    hasStopped: false,
  });

  // Calculate theoretical stopping distance and deceleration parameters
  const rMeters = params.radiusMm * 1e-3;
  const volume = (4 / 3) * Math.PI * Math.pow(rMeters, 3);
  const mass = params.sphereDensity * volume;
  const dragCoeff = 6 * Math.PI * params.fluidViscosity * rMeters;
  const k = mass > 0 ? dragCoeff / mass : 1;
  const theoreticalStopDist = k > 0 ? params.initialSpeed / k : 0;
  const netBuoyantWeight = (mass - params.fluidDensity * volume) * 9.8;
  const verticalTerminalSpeed = dragCoeff > 0 ? Math.max(0, netBuoyantWeight / dragCoeff) : 0;

  // Launch Sphere handler (launches from initial resting position)
  const handleLaunch = useCallback(() => {
    ballRef.current = {
      x: 0,
      y: 0,
      vx: params.initialSpeed,
      vy: 0,
      time: 0,
      hasStopped: false,
    };
    trailRef.current = [{ x: 0, y: 0, vx: params.initialSpeed, vy: 0 }];
    setTelemetry({
      speed: params.initialSpeed,
      vx: params.initialSpeed,
      vy: 0,
      time: 0,
      hasStopped: false,
    });
    setParams((p) => ({ ...p, isRunning: true }));
  }, [params.initialSpeed]);

  // Reset to initial ready position
  const handleResetToReady = useCallback(() => {
    ballRef.current = {
      x: 0,
      y: 0,
      vx: params.initialSpeed,
      vy: 0,
      time: 0,
      hasStopped: false,
    };
    trailRef.current = [];
    setTelemetry({
      speed: params.initialSpeed,
      vx: params.initialSpeed,
      vy: 0,
      time: 0,
      hasStopped: false,
    });
    setParams((p) => ({ ...p, isRunning: false }));
  }, [params.initialSpeed]);

  // Keep params ref synced
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(tankZoom);
  zoomRef.current = tankZoom;

  // Animation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let lastUiUpdate = 0;

    const loop = (now: number) => {
      const rawDt = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

      const p = paramsRef.current;
      const b = ballRef.current;
      const maxFlightX = 2.2 * zoomRef.current;
      const maxFlightY = 1.3 * zoomRef.current;

      // Apply Slow-Mo time speed
      const dt = rawDt * p.timeSpeed;

      if (p.isRunning && !b.hasStopped) {
        const step = computeHorizontalStokesTrajectory(
          p.initialSpeed,
          p.radiusMm * 1e-3,
          p.sphereDensity,
          p.fluidDensity,
          p.fluidViscosity,
          p.hasGravity,
          dt,
          b.x,
          b.y,
          b.vx,
          b.vy
        );

        b.x = step.nextX;
        b.y = step.nextY;
        b.vx = step.nextVx;
        b.vy = step.nextVy;
        b.time += dt;

        trailRef.current.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy });
        if (trailRef.current.length > 600) {
          trailRef.current.shift();
        }

        // Stopping criteria
        const isZeroGStopped = !p.hasGravity && (b.vx < 0.03 || Math.abs(b.x - theoreticalStopDist) < 0.01);
        const isBottomReached = p.hasGravity && b.y >= maxFlightY - 0.1;
        const isOutRight = b.x >= maxFlightX - 0.1;

        if (isZeroGStopped || isBottomReached || isOutRight) {
          b.hasStopped = true;
          if (isZeroGStopped) {
            b.vx = 0;
            b.vy = 0;
          }
        }
      }

      // Throttle UI text update to 12 FPS
      if (now - lastUiUpdate > 80) {
        lastUiUpdate = now;
        setTelemetry({
          speed: Math.hypot(b.vx, b.vy),
          vx: b.vx,
          vy: b.vy,
          time: b.time,
          hasStopped: b.hasStopped,
        });
      }

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
      const b = ballRef.current;

      // Tank Geometry
      const marginX = 40;
      const marginY = 35;
      const tankW = width - 2 * marginX;
      const tankH = height - 2 * marginY;

      // Scale depends on Zoom (1.0x -> 2.2m, 1.5x -> 3.3m, 2.0x -> 4.4m)
      const flightMaxMetersX = 2.2 * zoomRef.current;
      const flightMaxMetersY = 1.3 * zoomRef.current;

      const scaleX = tankW / flightMaxMetersX;
      const scaleY = tankH / flightMaxMetersY;

      const startPxX = marginX + 35;
      const startPxY = p.hasGravity ? marginY + 50 : marginY + tankH / 2;

      // 1. Fluid Tank Fill
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(marginX, marginY, tankW, tankH);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(marginX, marginY, tankW, tankH);

      // Background grid
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.lineWidth = 1;
      for (let x = marginX; x <= marginX + tankW; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, marginY);
        ctx.lineTo(x, marginY + tankH);
        ctx.stroke();
      }
      for (let y = marginY; y <= marginY + tankH; y += 40) {
        ctx.beginPath();
        ctx.moveTo(marginX, y);
        ctx.lineTo(marginX + tankW, y);
        ctx.stroke();
      }

      // Tank Title Badge
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'left';
      ctx.fillText(
        language === 'bn' ? 'সান্দ্র তরল চেম্বার (Horizontal Flight Medium)' : 'Viscous Liquid Medium Tank',
        marginX + 12,
        marginY + 18
      );

      // 2. Trajectory Ghost Path
      const tr = trailRef.current;
      if (tr.length > 1) {
        ctx.strokeStyle = p.hasGravity ? '#ea580c' : '#0284c7';
        ctx.lineWidth = 3.5;
        ctx.setLineDash(p.hasGravity ? [5, 3] : []);
        ctx.beginPath();
        tr.forEach((pt, idx) => {
          const px = startPxX + pt.x * scaleX;
          const py = startPxY + pt.y * scaleY;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. Stopping Distance Marker (For Zero-G)
      if (!p.hasGravity) {
        const stopPxX = startPxX + theoreticalStopDist * scaleX;
        if (stopPxX <= marginX + tankW) {
          ctx.strokeStyle = '#b91c1c';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(stopPxX, marginY + 20);
          ctx.lineTo(stopPxX, marginY + tankH - 20);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.fillStyle = '#b91c1c';
          ctx.textAlign = 'center';
          ctx.fillText(`x_stop = ${theoreticalStopDist.toFixed(2)} m`, stopPxX, marginY + 16);
        }
      }

      // 4. Moving Ball Position
      const currentBallPxX = startPxX + b.x * scaleX;
      const currentBallPxY = startPxY + b.y * scaleY;
      const visualRadius = Math.max(18, Math.min(36, 12 + p.radiusMm * 2.2));

      // Dark High-Contrast Metallic Sphere
      ctx.save();
      // Drop shadow
      ctx.beginPath();
      ctx.arc(currentBallPxX + 3, currentBallPxY + 4, visualRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fill();

      // Radial metallic shading
      const ballGrad = ctx.createRadialGradient(
        currentBallPxX - visualRadius * 0.35,
        currentBallPxY - visualRadius * 0.35,
        visualRadius * 0.08,
        currentBallPxX,
        currentBallPxY,
        visualRadius
      );
      ballGrad.addColorStop(0, '#ffffff'); // Crisp specular highlight
      ballGrad.addColorStop(0.25, '#64748b');
      ballGrad.addColorStop(0.75, '#0f172a'); // Deep dark metallic body
      ballGrad.addColorStop(1, '#020617'); // Dark rim

      ctx.beginPath();
      ctx.arc(currentBallPxX, currentBallPxY, visualRadius, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();
      ctx.restore();

      // 5. Dynamic Free Body & Velocity Decomposition Vectors (DEEP HIGH-CONTRAST COLORS)
      const currentSpeed = Math.hypot(b.vx, b.vy);
      if (p.isRunning && currentSpeed > 0.01) {
        // Resultant Velocity vector (Deep Indigo Blue arrow)
        const velAngle = Math.atan2(b.vy, b.vx);
        const velArrowLen = Math.min(75, currentSpeed * 20);
        const vxEnd = currentBallPxX + Math.cos(velAngle) * velArrowLen;
        const vyEnd = currentBallPxY + Math.sin(velAngle) * velArrowLen;

        ctx.strokeStyle = '#1d4ed8'; // Deep Indigo Blue
        ctx.fillStyle = '#1d4ed8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(currentBallPxX, currentBallPxY);
        ctx.lineTo(vxEnd, vyEnd);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vxEnd, vyEnd, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#1e40af';
        ctx.textAlign = 'left';
        ctx.fillText(`v = ${currentSpeed.toFixed(2)} m/s`, vxEnd + 8, vyEnd + 4);

        // Decomposed Velocity Components (vx in Deep Teal, vy in Deep Purple)
        if (p.hasGravity && b.vy > 0.05) {
          // vx component (Deep Teal)
          ctx.strokeStyle = '#0e7490';
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(currentBallPxX, currentBallPxY);
          ctx.lineTo(currentBallPxX + Math.cos(0) * Math.min(60, b.vx * 18), currentBallPxY);
          ctx.stroke();

          // vy component (Deep Purple)
          ctx.strokeStyle = '#7e22ce';
          ctx.beginPath();
          ctx.moveTo(currentBallPxX, currentBallPxY);
          ctx.lineTo(currentBallPxX, currentBallPxY + Math.min(60, b.vy * 18));
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Stokes Drag Vector F_v (Opposing Motion, Deep Golden Amber Arrow)
        const dragAngle = velAngle + Math.PI;
        const dragArrowLen = Math.min(60, currentSpeed * 16 + 18);
        const dxEnd = currentBallPxX + Math.cos(dragAngle) * dragArrowLen;
        const dyEnd = currentBallPxY + Math.sin(dragAngle) * dragArrowLen;

        ctx.strokeStyle = '#b45309'; // Deep Amber
        ctx.fillStyle = '#b45309';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(currentBallPxX, currentBallPxY);
        ctx.lineTo(dxEnd, dyEnd);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(dxEnd, dyEnd, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#92400e';
        ctx.textAlign = 'right';
        ctx.fillText('Fv (Drag)', dxEnd - 8, dyEnd + 4);

        // If Gravity is ON: Draw Weight (W) and Buoyancy (Fb)
        if (p.hasGravity) {
          // Downward Weight (Deep Crimson Red)
          ctx.strokeStyle = '#b91c1c';
          ctx.fillStyle = '#b91c1c';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(currentBallPxX, currentBallPxY);
          ctx.lineTo(currentBallPxX, currentBallPxY + 46);
          ctx.stroke();
          ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('W = mg ↓', currentBallPxX + 6, currentBallPxY + 42);

          // Upward Buoyant Force (Deep Ocean Cyan)
          ctx.strokeStyle = '#0284c7';
          ctx.fillStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(currentBallPxX, currentBallPxY);
          ctx.lineTo(currentBallPxX, currentBallPxY - 26);
          ctx.stroke();
          ctx.fillText('Fb ↑', currentBallPxX + 6, currentBallPxY - 22);
        }
      } else if (!p.isRunning && b.time === 0) {
        // Initial rest state preview above the ball (no horizontal arrow collision)
        ctx.save();
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#1d4ed8';
        ctx.textAlign = 'center';
        ctx.fillText(`v₀ = ${p.initialSpeed.toFixed(1)} m/s →`, currentBallPxX, currentBallPxY - visualRadius - 10);
        ctx.restore();
      }

      // 6. Ready State / Stopped State Label (in dedicated non-overlapping badges)
      if (!p.isRunning && b.time === 0) {
        ctx.save();
        const bannerW = language === 'bn' ? 385 : 360;
        const bannerH = 34;
        const bannerX = startPxX + visualRadius + 22;
        const bannerY = startPxY - bannerH / 2;

        ctx.fillStyle = 'rgba(240, 253, 244, 0.95)'; // Soft emerald card
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#15803d';
        ctx.textAlign = 'left';
        ctx.fillText(
          language === 'bn' ? '▶ প্রক্ষেপণের জন্য প্রস্তুত · বাম প্যানেলে "গোলক প্রক্ষেপণ" চাপুন' : '▶ Ready to Launch · Click "Launch Sphere" on left panel',
          bannerX + 12,
          bannerY + 21
        );
        ctx.restore();
      } else if (b.hasStopped) {
        ctx.save();
        const msg = !p.hasGravity
          ? language === 'bn'
            ? '✓ গোলকটি সান্দ্র বলের কারণে সম্পূর্ণ থেমে গেছে (vx = 0)'
            : '✓ Sphere brought to complete rest by Stokes Drag (vx = 0)'
          : language === 'bn'
          ? '✓ উল্লম্ব প্রান্তীয় বেগ অর্জন করেছে'
          : '✓ Reached steady vertical terminal descent';

        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        const textWidth = ctx.measureText(msg).width;
        const bannerW = textWidth + 24;
        const bannerH = 28;
        const bannerX = Math.max(marginX + 10, Math.min(marginX + tankW - bannerW - 10, currentBallPxX - bannerW / 2));
        const bannerY = currentBallPxY - visualRadius - 38;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = p.hasGravity ? '#ea580c' : '#059669';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = p.hasGravity ? '#c2410c' : '#047857';
        ctx.textAlign = 'center';
        ctx.fillText(msg, bannerX + bannerW / 2, bannerY + 18);
        ctx.restore();
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [language, theoreticalStopDist]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header Info */}
      <div className="bg-white border border-sky-200 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {t.horizontalTitle}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {t.horizontalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Gravity Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setParams((p) => ({ ...p, hasGravity: !p.hasGravity }));
                handleResetToReady();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all ${
                params.hasGravity
                  ? 'bg-orange-50 border border-orange-300 text-orange-900'
                  : 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              }`}
            >
              {params.hasGravity ? (
                <>
                  <ToggleRight className="w-4 h-4 text-orange-600" />
                  <span>{t.withGravity}</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-emerald-600" />
                  <span>{t.withoutGravity}</span>
                </>
              )}
            </button>

            {/* Launch Sphere Button */}
            <button
              type="button"
              onClick={handleLaunch}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>{t.launchSphere}</span>
            </button>

            {/* Reset to Start */}
            <button
              type="button"
              onClick={handleResetToReady}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{language === 'bn' ? 'শুরুতে নিন' : 'Reset'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Split: LEFT Side Control Panel + RIGHT Side Canvas Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        {/* Left Column: Control Panel with Green Sliders */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Sliders & Parameters */}
          <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>{t.controlsTitle}</span>
            </div>

            {/* Slow-Motion Speed Options */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Slow-Motion:</span>
                </span>
                <span className="text-emerald-800 font-mono text-[11px] font-bold">
                  {params.timeSpeed}x
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[0.25, 0.5, 1.0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setParams((p) => ({ ...p, timeSpeed: spd }))}
                    className={`py-1 text-xs font-bold rounded border transition-all cursor-pointer ${
                      params.timeSpeed === spd
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {spd === 0.25 ? '0.25x' : spd === 0.5 ? '0.5x' : '1.0x'}
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom / Distance Range Options */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Flight Range / Zoom:</span>
                </span>
                <span className="text-emerald-800 font-mono text-[11px] font-bold">
                  {(2.2 * tankZoom).toFixed(1)}m
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[1.0, 1.5, 2.0].map((zm) => (
                  <button
                    key={zm}
                    type="button"
                    onClick={() => {
                      setTankZoom(zm);
                      handleResetToReady();
                    }}
                    className={`py-1 text-xs font-bold rounded border transition-all cursor-pointer ${
                      tankZoom === zm
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {zm.toFixed(1)}x
                  </button>
                ))}
              </div>
            </div>

            {/* Initial Speed (GREEN SLIDER) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700">{t.initialSpeedLabel}:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                  {params.initialSpeed.toFixed(1)} m/s
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.5"
                value={params.initialSpeed}
                onChange={(e) => {
                  setParams((p) => ({ ...p, initialSpeed: parseFloat(e.target.value) }));
                  handleResetToReady();
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Sphere Radius (GREEN SLIDER) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700">{t.radiusLabel}:</span>
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                  {params.radiusMm.toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                min="2.0"
                max="15.0"
                step="0.5"
                value={params.radiusMm}
                onChange={(e) => {
                  setParams((p) => ({ ...p, radiusMm: parseFloat(e.target.value) }));
                  handleResetToReady();
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
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
                max="1.5"
                step="0.02"
                value={params.fluidViscosity}
                onChange={(e) => {
                  setParams((p) => ({ ...p, fluidViscosity: parseFloat(e.target.value) }));
                  handleResetToReady();
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Telemetry Readouts Card */}
          <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              <Target className="w-4 h-4 text-emerald-600" />
              <span>{language === 'bn' ? 'তাৎক্ষণিক ডেটা' : 'Live Trajectory Telemetry'}</span>
            </div>

            {/* Current Velocity */}
            <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-2.5">
              <div className="text-[11px] font-bold text-sky-800">
                {t.currentSpeedLabel}:
              </div>
              <div className="text-lg font-mono font-bold text-sky-950 mt-0.5">
                {telemetry.speed.toFixed(3)}{' '}
                <span className="text-xs font-normal text-sky-700">m/s</span>
              </div>
              <div className="text-[10px] text-sky-700 font-mono mt-0.5">
                vx: {telemetry.vx.toFixed(3)} m/s · vy: {telemetry.vy.toFixed(3)} m/s
              </div>
            </div>

            {/* Stopping Distance / Vertical Terminal Speed */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <div className="text-[11px] font-bold text-slate-700">
                {!params.hasGravity ? t.stoppingDistanceLabel : 'Vertical Terminal Speed (vTy)'}:
              </div>
              <div className="text-base font-mono font-bold text-slate-900 mt-0.5">
                {!params.hasGravity
                  ? `${theoreticalStopDist.toFixed(3)} m`
                  : `${verticalTerminalSpeed.toFixed(3)} m/s`}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {!params.hasGravity ? 'x_stop = (m · v₀) / (6πηr)' : 'vTy = (m - mf)g / (6πηr)'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Canvas Display (Spans 3 cols on desktop) */}
        <div className="lg:col-span-3 bg-white border border-sky-200 rounded-xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <canvas
            ref={canvasRef}
            className="w-full h-[400px] sm:h-[480px] rounded-lg bg-gradient-to-b from-sky-50/20 to-slate-50 border border-slate-100"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-slate-600 font-bold px-1">
            <span>
              {params.hasGravity
                ? language === 'bn'
                  ? 'বক্রপথ: অনুভূমিক মন্দন (vx → ০) এবং অভিকর্ষীয় পতন (vy → vTy)'
                  : 'Viscous Parabolic Arc: Horizontal retardation (vx → 0) coupled with vertical terminal fall (vy → vTy)'
                : language === 'bn'
                ? `বিশুদ্ধ অনুভূমিক মন্দন: vx(t) = v₀ e^(-kt) · থামার দূরত্ব = ${theoreticalStopDist.toFixed(2)} মিটার`
                : `Pure Zero-G Deceleration: vx(t) = v₀ e^(-kt) · Stopping Distance = ${theoreticalStopDist.toFixed(2)} m`}
            </span>
            <span className="font-mono text-slate-800 font-bold">t = {telemetry.time.toFixed(2)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
