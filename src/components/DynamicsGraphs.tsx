import React, { useState, useMemo } from 'react';
import { Download, Activity, Percent, BarChart3, Maximize2, SlidersHorizontal } from 'lucide-react';
import { Language, TubeData } from '../types';
import { TRANSLATIONS } from '../translations';

interface DynamicsGraphsProps {
  language: Language;
  tubes: TubeData[];
}

type GraphTab = 'vt' | 'at' | 'ft';
type ScaleMode = 'relative' | 'absolute';
type VelRangeOption = 'auto' | '0.5' | '1.5' | '3.0';

export const DynamicsGraphs: React.FC<DynamicsGraphsProps> = ({ language, tubes }) => {
  const t = TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState<GraphTab>('vt');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('relative');
  const [selectedFilter, setSelectedFilter] = useState<'all' | number>('all');
  const [velRange, setVelRange] = useState<VelRangeOption>('auto');

  // Determine active tubes to render
  const visibleTubes = useMemo(() => {
    if (selectedFilter === 'all') return tubes;
    const single = tubes[selectedFilter];
    return single ? [single] : tubes;
  }, [tubes, selectedFilter]);

  // Determine dynamic bounds based on visible tubes & range constraints
  const { maxTime, maxVel, maxAccel, maxForce } = useMemo(() => {
    let mTime = 3.0;
    let mAccel = 9.8;
    let mForce = 0.005;

    const targets = selectedFilter === 'all' ? tubes : [tubes[selectedFilter] || tubes[0]];

    // 1. Time & Acceleration & Force tracking
    targets.forEach((tube) => {
      if (tube.history.length > 0) {
        const lastT = tube.history[tube.history.length - 1].time;
        if (lastT > mTime) mTime = lastT;
      }
      if (tube.state.time > mTime) mTime = tube.state.time;
      if (tube.state.acceleration * 1.15 > mAccel) mAccel = tube.state.acceleration * 1.15;
      if (tube.state.weight * 1.25 > mForce) mForce = tube.state.weight * 1.25;
    });

    // 2. Realistic Velocity Bounds (CRITICAL: Never let low-viscosity Stokes vT blow up to 400+ m/s)
    let observedPeakVel = 0.05;
    targets.forEach((tb) => {
      tb.history.forEach((pt) => {
        if (pt.velocity > observedPeakVel) observedPeakVel = pt.velocity;
      });
      if (tb.state.velocity > observedPeakVel) observedPeakVel = tb.state.velocity;
    });

    // Realistic terminal velocity for the visible fluids (capped at 2.0 m/s max for rig framing)
    let realisticTerminalVel = 0.05;
    targets.forEach((tb) => {
      const v = Math.min(2.0, tb.state.terminalVelocity);
      if (v > realisticTerminalVel) realisticTerminalVel = v;
    });

    let calcMaxVel = 1.5;
    if (velRange === '0.5') {
      calcMaxVel = 0.5;
    } else if (velRange === '1.5') {
      calcMaxVel = 1.5;
    } else if (velRange === '3.0') {
      calcMaxVel = 3.0;
    } else {
      // Auto Mode: frame tightly around observed velocities & true fluid terminal speeds
      if (selectedFilter !== 'all') {
        const soloTube = tubes[selectedFilter];
        const soloVT = soloTube?.state.terminalVelocity || 0.25;
        if (soloVT < 0.4) {
          calcMaxVel = Math.max(0.3, Math.min(0.45, Math.max(observedPeakVel * 1.2, soloVT * 1.2)));
        } else if (soloVT < 1.2) {
          calcMaxVel = Math.max(0.8, Math.min(1.4, Math.max(observedPeakVel * 1.2, soloVT * 1.15)));
        } else {
          calcMaxVel = Math.max(1.5, Math.min(2.5, observedPeakVel * 1.25));
        }
      } else {
        // Multi-flask comparison Auto: comfortable framing (0.4 m/s to 2.2 m/s)
        const peak = Math.max(observedPeakVel * 1.25, realisticTerminalVel * 1.15, 0.4);
        calcMaxVel = Math.min(2.2, Math.max(0.4, peak));
      }
    }

    return {
      maxTime: Math.max(3.0, mTime * 1.08),
      maxVel: calcMaxVel,
      maxAccel: Math.max(9.8, mAccel),
      maxForce: Math.max(0.005, mForce),
    };
  }, [tubes, selectedFilter, velRange]);

  // Graph geometry (Taller, crisper 230px height)
  const width = 390;
  const height = 230;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 34;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toX = (time: number) => padLeft + (Math.min(time, maxTime) / maxTime) * plotW;
  const toY = (val: number, maxVal: number) => padTop + plotH - (Math.min(val, maxVal) / maxVal) * plotH;

  // Path generator for a tube
  const getTubePath = (
    tube: TubeData,
    field: 'velocity' | 'acceleration' | 'drag',
    maxVal: number,
    isRelative = false
  ) => {
    if (tube.history.length === 0) return '';
    return tube.history.reduce((acc, pt, idx) => {
      const x = toX(pt.time);
      let rawVal = Math.max(0, pt[field]);
      if (isRelative && field === 'velocity') {
        // If fluid has a realistic Stokes vT (< 3 m/s), normalize by vT;
        // for low-viscosity fluids (water), normalize by max expected column speed (~2.2 m/s)
        const normRef = tube.viscosity < 0.02 ? 2.2 : Math.max(0.0001, tube.state.terminalVelocity);
        rawVal = Math.min(1.15, rawVal / normRef) * 100; // 0 to 100%
      }
      const y = toY(rawVal, maxVal);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  // Export combined CSV
  const handleExportCSV = () => {
    let csv = 'Time(s),Tube,Fluid,Velocity(m/s),TerminalVelocity(m/s),Acceleration(m/s2),Drag(N)\n';
    tubes.forEach((tb) => {
      tb.history.forEach((pt) => {
        csv += `${pt.time.toFixed(4)},${tb.id},${tb.fluidNameEn},${pt.velocity.toFixed(4)},${tb.state.terminalVelocity.toFixed(4)},${pt.acceleration.toFixed(4)},${pt.drag.toFixed(6)}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal_velocity_multi_comparison_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRelativeVt = activeTab === 'vt' && scaleMode === 'relative';
  const yMaxForVt = isRelativeVt ? 100 : maxVel;

  return (
    <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs flex flex-col gap-2.5">
      {/* Top Header: Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t.graphsTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Relative % vs Absolute Toggle for v-t graph */}
          {activeTab === 'vt' && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setScaleMode('relative')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  scaleMode === 'relative'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.graphZoomTip}
              >
                <Percent className="w-2.5 h-2.5" />
                <span>% v/vT</span>
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('absolute')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  scaleMode === 'absolute'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Absolute Velocity in m/s"
              >
                <BarChart3 className="w-2.5 h-2.5" />
                <span>m/s</span>
              </button>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            type="button"
            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium rounded-md flex items-center gap-1 transition-colors cursor-pointer"
            title="Export Telemetry to CSV"
          >
            <Download className="w-3 h-3 text-slate-500" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Variable Tabs (v-t, a-t, F-t) */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setActiveTab('vt')}
          type="button"
          className={`flex-1 py-1 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'vt'
              ? 'bg-white text-blue-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          v - t (Velocity)
        </button>
        <button
          onClick={() => setActiveTab('at')}
          type="button"
          className={`flex-1 py-1 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'at'
              ? 'bg-white text-amber-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          a - t (Decay)
        </button>
        <button
          onClick={() => setActiveTab('ft')}
          type="button"
          className={`flex-1 py-1 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'ft'
              ? 'bg-white text-violet-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Drag Fv (t)
        </button>
      </div>

      {/* Filter Tabs & Velocity Range Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200/80">
        {/* Solo Flask Selector */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.graphFilterAll}
          </button>
          {tubes.map((tb, idx) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setSelectedFilter(idx)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer truncate ${
                selectedFilter === idx
                  ? 'bg-white text-slate-900 shadow-2xs border'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              style={{
                borderColor: selectedFilter === idx ? tb.lineColor : 'transparent',
              }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tb.lineColor }} />
              <span className="truncate">
                {language === 'bn' ? `ফ্লাস্ক ${idx + 1}` : `Flask ${idx + 1}`}
              </span>
            </button>
          ))}
        </div>

        {/* Velocity Range Options (m/s scale limiter so graph is NEVER flattened) */}
        {!isRelativeVt && activeTab === 'vt' && (
          <div className="flex items-center gap-0.5 text-[10px] font-semibold bg-white px-1 py-0.5 rounded border border-slate-200">
            <span className="text-slate-400 text-[9px] mr-0.5 flex items-center gap-0.5">
              <SlidersHorizontal className="w-2.5 h-2.5 text-slate-500" />
              <span>{language === 'bn' ? 'রেঞ্জ:' : 'Range:'}</span>
            </span>
            {(['auto', '0.5', '1.5', '3.0'] as VelRangeOption[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setVelRange(r)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono cursor-pointer transition-all ${
                  velRange === r
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Set maximum velocity scale to ${r === 'auto' ? 'Auto-fit' : r + ' m/s'}`}
              >
                {r === 'auto' ? (language === 'bn' ? 'অটো' : 'Auto') : `${r}m/s`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SVG Canvas Multi-Line Chart (Height 230px, fully legible, no 400+ m/s blowout) */}
      <div className="relative w-full overflow-hidden bg-gradient-to-b from-slate-50/90 to-white rounded-lg border border-slate-200 p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
          {/* Subtle Horizontal Grid lines & labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke={ratio === 0 ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={ratio === 0 ? 1.5 : 1}
                  strokeDasharray={ratio === 0 ? undefined : '3,3'}
                />
              </g>
            );
          })}

          {/* Time axis vertical ticks */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
            const x = padLeft + plotW * ratio;
            const tVal = (maxTime * ratio).toFixed(1);
            return (
              <g key={ratio}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + plotH}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padTop + plotH + 13}
                  textAnchor="middle"
                  className="text-[8px] fill-slate-400 font-mono"
                >
                  {tVal}s
                </text>
              </g>
            );
          })}

          {/* Time axis label */}
          <text
            x={padLeft + plotW / 2}
            y={height - 5}
            textAnchor="middle"
            className="text-[9px] fill-slate-600 font-sans font-semibold"
          >
            {language === 'bn' ? 'সময় t (সেকেন্ড)' : 'Time t (seconds)'}
          </text>

          {/* TAB 1: v - t (Velocity) */}
          {activeTab === 'vt' && (
            <>
              {/* If Relative % scale: draw the 100% Terminal Velocity saturation line */}
              {isRelativeVt && (
                <g>
                  <line
                    x1={padLeft}
                    y1={padTop}
                    x2={padLeft + plotW}
                    y2={padTop}
                    stroke="#059669"
                    strokeWidth="1.8"
                    strokeDasharray="4,4"
                  />
                  <rect
                    x={padLeft + plotW - 98}
                    y={padTop - 11}
                    width={96}
                    height={14}
                    rx="3"
                    fill="#ecfdf5"
                    stroke="#10b981"
                    strokeWidth="0.8"
                  />
                  <text
                    x={padLeft + plotW - 50}
                    y={padTop - 2}
                    textAnchor="middle"
                    className="text-[8.5px] fill-emerald-800 font-bold font-sans"
                  >
                    100% (vT Reached)
                  </text>
                </g>
              )}

              {/* Render Visible Curves */}
              {visibleTubes.map((tube) => {
                const pathStr = getTubePath(tube, 'velocity', yMaxForVt, isRelativeVt);
                const currentV = tube.state.velocity;
                const normRef = tube.viscosity < 0.02 ? 2.2 : Math.max(0.0001, tube.state.terminalVelocity);
                const plotVal = isRelativeVt ? Math.min(1.15, currentV / normRef) * 100 : currentV;

                // Absolute asymptote dashed line (Only drawn if within realistic frame <= yMaxForVt * 1.05)
                const vT = tube.state.terminalVelocity;
                const asympY = toY(vT, maxVel);
                const showAsymptote = !isRelativeVt && vT <= maxVel * 1.05 && asympY >= padTop && asympY <= padTop + plotH;

                return (
                  <g key={tube.id}>
                    {showAsymptote && (
                      <g>
                        <line
                          x1={padLeft}
                          y1={asympY}
                          x2={padLeft + plotW}
                          y2={asympY}
                          stroke={tube.lineColor}
                          strokeWidth="1.4"
                          strokeDasharray="3,3"
                          opacity={0.75}
                        />
                        <text
                          x={padLeft + plotW - 4}
                          y={asympY - 3}
                          textAnchor="end"
                          className="text-[8px] font-mono font-bold"
                          fill={tube.lineColor}
                        >
                          vT={vT.toFixed(3)}
                        </text>
                      </g>
                    )}

                    {/* Live v-t curve with smooth thick stroke */}
                    {pathStr && (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={tube.lineColor}
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Current point dot */}
                    {tube.history.length > 0 && (
                      <circle
                        cx={toX(tube.state.time)}
                        cy={toY(plotVal, yMaxForVt)}
                        r="4.5"
                        fill={tube.lineColor}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                );
              })}

              {/* Y-Axis Numerical Labels */}
              {isRelativeVt ? (
                <>
                  <text x={padLeft - 6} y={padTop + 4} textAnchor="end" className="text-[8px] fill-emerald-700 font-mono font-bold">
                    100%
                  </text>
                  <text x={padLeft - 6} y={padTop + plotH * 0.5 + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    50%
                  </text>
                  <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    0%
                  </text>
                  <text
                    x={13}
                    y={padTop + plotH / 2}
                    textAnchor="middle"
                    transform={`rotate(-90, 13, ${padTop + plotH / 2})`}
                    className="text-[9.5px] fill-emerald-800 font-sans font-bold"
                  >
                    % of vT
                  </text>
                </>
              ) : (
                <>
                  <text x={padLeft - 6} y={padTop + 4} textAnchor="end" className="text-[8px] fill-blue-700 font-mono font-bold">
                    {maxVel.toFixed(2)}
                  </text>
                  <text x={padLeft - 6} y={padTop + plotH * 0.5 + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    {(maxVel / 2).toFixed(2)}
                  </text>
                  <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    0.0
                  </text>
                  <text
                    x={13}
                    y={padTop + plotH / 2}
                    textAnchor="middle"
                    transform={`rotate(-90, 13, ${padTop + plotH / 2})`}
                    className="text-[9.5px] fill-blue-800 font-sans font-bold"
                  >
                    v (m/s)
                  </text>
                </>
              )}
            </>
          )}

          {/* TAB 2: a - t (Acceleration) */}
          {activeTab === 'at' && (
            <>
              {visibleTubes.map((tube) => {
                const pathStr = getTubePath(tube, 'acceleration', maxAccel);
                return (
                  <g key={tube.id}>
                    {pathStr && (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={tube.lineColor}
                        strokeWidth="3.0"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {tube.history.length > 0 && (
                      <circle
                        cx={toX(tube.state.time)}
                        cy={toY(tube.state.acceleration, maxAccel)}
                        r="4"
                        fill={tube.lineColor}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                      />
                    )}
                  </g>
                );
              })}
              <text x={padLeft - 6} y={padTop + 4} textAnchor="end" className="text-[8px] fill-amber-700 font-mono font-bold">
                {maxAccel.toFixed(1)}
              </text>
              <text x={padLeft - 6} y={padTop + plotH * 0.5 + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                {(maxAccel / 2).toFixed(1)}
              </text>
              <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                0.0
              </text>
              <text
                x={13}
                y={padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90, 13, ${padTop + plotH / 2})`}
                className="text-[9.5px] fill-amber-800 font-sans font-bold"
              >
                a (m/s²)
              </text>
            </>
          )}

          {/* TAB 3: Drag Fv (t) */}
          {activeTab === 'ft' && (
            <>
              {visibleTubes.map((tube) => {
                const pathStr = getTubePath(tube, 'drag', maxForce);
                return (
                  <g key={tube.id}>
                    {pathStr && (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={tube.lineColor}
                        strokeWidth="3.0"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {tube.history.length > 0 && (
                      <circle
                        cx={toX(tube.state.time)}
                        cy={toY(tube.state.viscousDrag, maxForce)}
                        r="4"
                        fill={tube.lineColor}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                      />
                    )}
                  </g>
                );
              })}
              <text x={padLeft - 6} y={padTop + 4} textAnchor="end" className="text-[8px] fill-violet-700 font-mono font-bold">
                {(maxForce * 1000).toFixed(1)}mN
              </text>
              <text x={padLeft - 6} y={padTop + plotH * 0.5 + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                {((maxForce * 1000) / 2).toFixed(1)}
              </text>
              <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                0
              </text>
              <text
                x={13}
                y={padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90, 13, ${padTop + plotH / 2})`}
                className="text-[9.5px] fill-violet-800 font-sans font-bold"
              >
                Fv (mN)
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Interactive Liquid Cards Legend with Live % vT & Solo-Zoom Click */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        {tubes.map((tube, idx) => {
          const normVT = tube.viscosity < 0.02 ? 2.2 : Math.max(0.0001, tube.state.terminalVelocity);
          const percentAchieved = Math.min(100, (tube.state.velocity / normVT) * 100);
          const isSolo = selectedFilter === idx;

          return (
            <button
              key={tube.id}
              type="button"
              onClick={() => setSelectedFilter(selectedFilter === idx ? 'all' : idx)}
              className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col ${
                isSolo
                  ? 'bg-sky-50/80 shadow-2xs'
                  : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200'
              }`}
              style={{
                borderColor: isSolo ? tube.lineColor : undefined,
                borderWidth: isSolo ? 1.8 : 1,
              }}
              title="Click to solo zoom this fluid on the graph"
            >
              <div className="flex items-center gap-1 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: tube.lineColor }} />
                <span className="font-bold text-[10px] text-slate-800 truncate">
                  {language === 'bn' ? `ফ্লাস্ক ${idx + 1}` : `Flask ${idx + 1}`}
                </span>
                {isSolo && (
                  <Maximize2 className="w-2.5 h-2.5 text-slate-500 ml-auto shrink-0" />
                )}
              </div>

              <div className="text-[9.5px] font-semibold text-slate-700 truncate mb-0.5">
                {language === 'bn' ? tube.fluidNameBn : tube.fluidNameEn}
              </div>

              <div className="text-[9px] font-mono text-slate-600 flex justify-between">
                <span>v:</span>
                <span className="font-bold">{tube.state.velocity.toFixed(3)} m/s</span>
              </div>

              <div className="text-[9px] font-mono flex justify-between" style={{ color: tube.lineColor }}>
                <span>vT:</span>
                <span className="font-bold">
                  {tube.state.terminalVelocity > 10 ? '>10 m/s' : tube.state.terminalVelocity.toFixed(3)}
                </span>
              </div>

              {/* Progress bar towards terminal velocity */}
              <div className="mt-1 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${percentAchieved.toFixed(0)}%`,
                    backgroundColor: tube.lineColor,
                  }}
                />
              </div>
              <div className="text-[8px] text-slate-500 font-mono text-right mt-0.5">
                {percentAchieved.toFixed(0)}% vT
              </div>
            </button>
          );
        })}
      </div>

      {/* Helpful physics cue */}
      <div className="text-[10px] text-slate-500 bg-sky-50/50 rounded-md px-2 py-1 border border-sky-100 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span>
          {isRelativeVt
            ? language === 'bn'
              ? 'আপেক্ষিক শতাংশ ভিউ: সব তরলের প্রান্তীয় বেগের গ্রাফ স্পষ্ট দেখতে এই মোড ব্যবহার করুন।'
              : 'Relative % View: View clear rise-time to terminal velocity for all fluids.'
            : language === 'bn'
              ? 'বাস্তব মান ভিউ (m/s): রেঞ্জ সিলেক্টর (Auto / 0.5 / 1.5 / 3.0 m/s) ব্যবহার করে গ্রাফ ইচ্ছেমতো জুম করুন।'
              : 'Absolute View (m/s): Use Range Selector (Auto / 0.5 / 1.5 / 3.0 m/s) to zoom the scale.'}
        </span>
      </div>
    </div>
  );
};
