import React from 'react';
import { Compass, Calculator, Wind, Gauge, Layers, Scale } from 'lucide-react';
import { Language, SimulationParams, SimulationState, TubeData } from '../types';
import { calculateViscosityAtTemp } from '../physics';
import { TRANSLATIONS } from '../translations';

interface DataCardsProps {
  language: Language;
  params: SimulationParams;
  state: SimulationState;
  tubes?: TubeData[];
  selectedFlaskIdx?: number;
  onSelectFlaskIdx?: (idx: number) => void;
}

export const DataCards: React.FC<DataCardsProps> = ({
  language,
  params,
  state: propState,
  tubes,
  selectedFlaskIdx = 0,
  onSelectFlaskIdx,
}) => {
  const t = TRANSLATIONS[language];
  
  // Use active tube data if available
  const activeTube = tubes && tubes[selectedFlaskIdx] ? tubes[selectedFlaskIdx] : null;
  const state = activeTube ? activeTube.state : propState;
  const activeFluidVisc = activeTube ? activeTube.viscosity : params.fluidViscosity;
  const activeFluidDensity = activeTube ? activeTube.density : params.fluidDensity;
  
  const rMeters = params.radiusMm * 1e-3;
  const effectiveViscosity = calculateViscosityAtTemp(activeFluidVisc, params.temperatureC);
  const netDensity = params.sphereDensity - activeFluidDensity;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Flask Tabs if multi-flask available */}
      {tubes && tubes.length > 1 && onSelectFlaskIdx && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {tubes.map((tb, idx) => {
              const tabName = language === 'bn' ? `ফ্লাস্ক ${idx + 1}: ${tb.fluidNameBn}` : `Flask ${idx + 1}: ${tb.fluidNameEn}`;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => onSelectFlaskIdx(idx)}
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all cursor-pointer truncate ${
                    selectedFlaskIdx === idx
                      ? 'bg-white shadow-xs font-bold ring-1 ring-black/5'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  style={{
                    color: selectedFlaskIdx === idx ? tb.lineColor : undefined,
                    borderBottom: selectedFlaskIdx === idx ? `2px solid ${tb.lineColor}` : 'none',
                  }}
                >
                  {tabName}
                </button>
              );
            })}
          </div>

          {/* Active Fluid Status Strip */}
          {activeTube && (
            <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeTube.lineColor }} />
                <span>{language === 'bn' ? activeTube.fluidNameBn : activeTube.fluidNameEn}</span>
              </span>
              <span className="font-mono text-slate-600">
                η = {effectiveViscosity.toFixed(4)} Pa·s · σ = {activeFluidDensity} kg/m³
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live Digital Telemetry Deck */}
      <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t.telemetryTitle} ({language === 'bn' ? `ফ্লাস্ক ${selectedFlaskIdx + 1}: ${activeTube?.fluidNameBn}` : `Flask ${selectedFlaskIdx + 1}: ${activeTube?.fluidNameEn}`})
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            t = {state.time.toFixed(2)}s · y = {(state.positionY * 100).toFixed(1)} cm
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Current Velocity */}
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-sky-800 flex items-center justify-between">
              <span>{t.velocityNow}</span>
              <Gauge className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-sky-950 mt-0.5">
              {state.velocity.toFixed(3)}{' '}
              <span className="text-xs font-normal text-sky-700">m/s</span>
            </div>
            <div className="text-[10px] text-sky-700 font-mono mt-0.5">
              {t.terminalVelocityVal}: {state.terminalVelocity.toFixed(3)} m/s
            </div>
          </div>

          {/* Current Acceleration */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-amber-800 flex items-center justify-between">
              <span>{t.accelerationNow}</span>
              <Scale className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-amber-950 mt-0.5">
              {state.acceleration.toFixed(2)}{' '}
              <span className="text-xs font-normal text-amber-700">m/s²</span>
            </div>
            <div className="text-[10px] text-amber-700 font-mono mt-0.5">
              {state.isTerminalAchieved ? 'At Terminal Speed (a = 0)' : 'Falling towards a → 0'}
            </div>
          </div>

          {/* Reynolds Number & Flow Regime */}
          <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-slate-600" />
                <span>{t.reynoldsNumber} (Re):</span>
              </span>
              <span className="font-mono font-bold text-slate-900">
                {state.reynoldsNumber.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
              <span
                className={`font-medium ${
                  state.isLaminar ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'
                }`}
              >
                {state.isLaminar ? t.laminar : t.turbulent}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Threshold: Re = 2000
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Formula Derivation & Real Substitution Card */}
      <div className="bg-white border border-sky-200 rounded-xl p-3.5 shadow-2xs">
        <div className="flex items-center gap-1.5 mb-2.5 border-b border-slate-100 pb-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t.formulaCardTitle}
          </span>
        </div>

        {/* Terminal Velocity Formula */}
        <div className="mb-3">
          <div className="text-[11px] font-semibold text-slate-700 mb-1">
            {t.terminalFormulaTitle}:
          </div>
          <div className="bg-slate-900 text-sky-300 font-mono text-[11px] p-2.5 rounded-lg border border-slate-800 space-y-1">
            <div className="text-slate-300">
              v_T = (2/9) × [r² × (ρ - σ) × g] / η
            </div>
            {/* Live Values Substituted */}
            <div className="text-emerald-400 pt-1 border-t border-slate-800 text-[10px] sm:text-[11px] overflow-x-auto">
              v_T = (2/9) × [({rMeters.toFixed(4)})² × ({params.sphereDensity} - {activeFluidDensity}) × 9.8] / {effectiveViscosity.toFixed(4)}
            </div>
            <div className="text-white font-bold pt-0.5">
              v_T = {state.terminalVelocity.toFixed(4)} m/s
            </div>
          </div>
        </div>

        {/* Stokes' Drag Law */}
        <div>
          <div className="text-[11px] font-semibold text-slate-700 mb-1">
            {t.stokesLawTitle}:
          </div>
          <div className="bg-slate-900 text-amber-300 font-mono text-[11px] p-2.5 rounded-lg border border-slate-800 space-y-1">
            <div className="text-slate-300">
              F_v = 6 × π × η × r × v(t)
            </div>
            <div className="text-amber-200 pt-1 border-t border-slate-800 text-[10px] sm:text-[11px] overflow-x-auto">
              F_v = 6 × 3.1416 × {effectiveViscosity.toFixed(4)} × {rMeters.toFixed(4)} × {state.velocity.toFixed(3)}
            </div>
            <div className="text-white font-bold pt-0.5 flex items-center justify-between">
              <span>F_v = {(state.viscousDrag * 1000).toFixed(2)} mN</span>
              <span className="text-[10px] text-amber-400 font-normal">
                {state.isTerminalAchieved ? '(= W - Fb)' : 'Growing with v(t)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
