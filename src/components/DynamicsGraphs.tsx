import React, { useState, useMemo } from 'react';
import { Download, Activity, Layers } from 'lucide-react';
import { Language, TubeData } from '../types';
import { TRANSLATIONS } from '../translations';

interface DynamicsGraphsProps {
  language: Language;
  tubes: TubeData[];
}

type GraphTab = 'vt' | 'at' | 'ft';

export const DynamicsGraphs: React.FC<DynamicsGraphsProps> = ({ language, tubes }) => {
  const t = TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState<GraphTab>('vt');
  const [hoverTubeIdx, setHoverTubeIdx] = useState<number>(0);

  // Determine global bounds across all 3 tubes
  const { maxTime, maxVel, maxAccel, maxForce } = useMemo(() => {
    let mTime = 3.0;
    let mVel = 0.5;
    let mAccel = 9.8;
    let mForce = 0.01;

    tubes.forEach((tube) => {
      if (tube.history.length > 0) {
        const lastT = tube.history[tube.history.length - 1].time;
        if (lastT > mTime) mTime = lastT;
      }
      if (tube.state.time > mTime) mTime = tube.state.time;
      if (tube.state.terminalVelocity * 1.25 > mVel) mVel = tube.state.terminalVelocity * 1.25;
      if (tube.state.acceleration * 1.15 > mAccel) mAccel = tube.state.acceleration * 1.15;
      if (tube.state.weight * 1.25 > mForce) mForce = tube.state.weight * 1.25;
    });

    return {
      maxTime: Math.max(3.0, mTime * 1.1),
      maxVel: Math.max(0.2, mVel),
      maxAccel: Math.max(9.8, mAccel),
      maxForce: Math.max(0.005, mForce),
    };
  }, [tubes]);

  // Graph geometry
  const width = 380;
  const height = 190;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 22;
  const padBottom = 32;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toX = (time: number) => padLeft + (Math.min(time, maxTime) / maxTime) * plotW;
  const toY = (val: number, maxVal: number) => padTop + plotH - (Math.min(val, maxVal) / maxVal) * plotH;

  // Path generator for a tube
  const getTubePath = (tube: TubeData, field: 'velocity' | 'acceleration' | 'drag', maxVal: number) => {
    if (tube.history.length === 0) return '';
    return tube.history.reduce((acc, pt, idx) => {
      const x = toX(pt.time);
      const y = toY(Math.max(0, pt[field]), maxVal);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  // Export combined CSV
  const handleExportCSV = () => {
    let csv = 'Time(s),Tube,Fluid,Velocity(m/s),Acceleration(m/s2),Drag(N)\n';
    tubes.forEach((tb) => {
      tb.history.forEach((pt) => {
        csv += `${pt.time.toFixed(4)},${tb.id},${tb.fluidNameEn},${pt.velocity.toFixed(4)},${pt.acceleration.toFixed(4)},${pt.drag.toFixed(6)}\n`;
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

  return (
    <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs">
      {/* Header and Graph Tabs */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t.graphsTitle}
          </span>
        </div>

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

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-2">
        <button
          onClick={() => setActiveTab('vt')}
          type="button"
          className={`flex-1 py-1 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'vt'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          v - t (Comparison)
        </button>
        <button
          onClick={() => setActiveTab('at')}
          type="button"
          className={`flex-1 py-1 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
            activeTab === 'at'
              ? 'bg-white text-amber-700 shadow-xs'
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
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Drag Fv (t)
        </button>
      </div>

      {/* SVG Canvas Multi-Line Chart */}
      <div className="relative w-full overflow-hidden bg-slate-50/70 rounded-lg border border-slate-200 p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
          {/* Grid lines */}
          <line x1={padLeft} y1={padTop} x2={padLeft + plotW} y2={padTop} stroke="#e2e8f0" strokeDasharray="2,2" />
          <line x1={padLeft} y1={padTop + plotH / 2} x2={padLeft + plotW} y2={padTop + plotH / 2} stroke="#e2e8f0" strokeDasharray="2,2" />
          <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Time axis label */}
          <text x={padLeft + plotW / 2} y={height - 6} textAnchor="middle" className="text-[9px] fill-slate-500 font-sans">
            Time t (seconds)
          </text>

          {/* Render Multi-Curves for each of the 3 Tubes */}
          {activeTab === 'vt' && (
            <>
              {tubes.map((tube, i) => {
                const pathStr = getTubePath(tube, 'velocity', maxVel);
                const asympY = toY(tube.state.terminalVelocity, maxVel);
                return (
                  <g key={tube.id}>
                    {/* Asymptote Dashed Line */}
                    <line
                      x1={padLeft}
                      y1={asympY}
                      x2={padLeft + plotW}
                      y2={asympY}
                      stroke={tube.lineColor}
                      strokeWidth="1.2"
                      strokeDasharray="3,3"
                      opacity={0.65}
                    />

                    {/* Live v-t curve */}
                    {pathStr && (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={tube.lineColor}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Current point dot */}
                    {tube.history.length > 0 && (
                      <circle
                        cx={toX(tube.state.time)}
                        cy={toY(tube.state.velocity, maxVel)}
                        r="3.5"
                        fill={tube.lineColor}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                );
              })}

              <text x={padLeft - 6} y={padTop + 4} textAnchor="end" className="text-[8px] fill-slate-600 font-mono font-bold">
                {maxVel.toFixed(2)}
              </text>
              <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                0.0
              </text>
              <text
                x={12}
                y={padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90, 12, ${padTop + plotH / 2})`}
                className="text-[9px] fill-slate-700 font-sans font-bold"
              >
                v (m/s)
              </text>
            </>
          )}

          {activeTab === 'at' && (
            <>
              {tubes.map((tube) => {
                const pathStr = getTubePath(tube, 'acceleration', maxAccel);
                return (
                  <g key={tube.id}>
                    {pathStr && (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={tube.lineColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    )}
                  </g>
                );
              })}
              <text x={padLeft - 6} y={padTop + 4} textAnchor="end" className="text-[8px] fill-slate-600 font-mono font-bold">
                {maxAccel.toFixed(1)}
              </text>
              <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                0.0
              </text>
              <text
                x={12}
                y={padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90, 12, ${padTop + plotH / 2})`}
                className="text-[9px] fill-slate-700 font-sans font-bold"
              >
                a (m/s²)
              </text>
            </>
          )}

          {activeTab === 'ft' && (
            <>
              {tubes.map((tube) => {
                const pathStr = getTubePath(tube, 'drag', maxForce);
                return (
                  <g key={tube.id}>
                    {pathStr && (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={tube.lineColor}
                        strokeWidth="2.5"
                      />
                    )}
                  </g>
                );
              })}
              <text x={padLeft - 6} y={padTop + 4} textAnchor="end" className="text-[8px] fill-slate-600 font-mono font-bold">
                {(maxForce * 1000).toFixed(0)}mN
              </text>
              <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                0
              </text>
              <text
                x={12}
                y={padTop + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90, 12, ${padTop + plotH / 2})`}
                className="text-[9px] fill-slate-700 font-sans font-bold"
              >
                Fv (mN)
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Multi-Tube Color Legend */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
        {tubes.map((tube, idx) => (
          <div
            key={tube.id}
            className="flex flex-col p-1.5 rounded-lg border border-slate-100 bg-slate-50/60"
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tube.lineColor }} />
              <span className="font-bold text-[10px] text-slate-800 truncate">
                {language === 'bn' ? `ফ্লাস্ক ${idx + 1}: ${tube.fluidNameBn}` : `Flask ${idx + 1}: ${tube.fluidNameEn}`}
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-600">
              v: {tube.state.velocity.toFixed(3)} m/s
            </div>
            <div className="text-[9px] font-mono font-bold" style={{ color: tube.lineColor }}>
              vT: {tube.state.terminalVelocity.toFixed(3)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
