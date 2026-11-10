import React from 'react';
import { Play, Pause, RotateCcw, Droplets, CircleDot, Thermometer, Sliders, ArrowDownCircle, Gauge, Layers } from 'lucide-react';
import { Language, SimulationParams, TubeData } from '../types';
import { FLUID_PRESETS, MATERIAL_PRESETS, calculateViscosityAtTemp } from '../physics';
import { TRANSLATIONS } from '../translations';

interface ControlSidebarProps {
  language: Language;
  params: SimulationParams;
  onChangeParams: (updater: (prev: SimulationParams) => SimulationParams) => void;
  tubes: TubeData[];
  onChangeTubeFluid: (tubeIndex: number, fluidId: string) => void;
  onDropAll: () => void;
  onTogglePause: () => void;
  onResetAll: () => void;
  selectedMaterialId: string;
  onSelectMaterial: (id: string) => void;
  isAnyRunning: boolean;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  language,
  params,
  onChangeParams,
  tubes,
  onChangeTubeFluid,
  onDropAll,
  onTogglePause,
  onResetAll,
  selectedMaterialId,
  onSelectMaterial,
  isAnyRunning,
}) => {
  const t = TRANSLATIONS[language];
  const effectiveViscosity = calculateViscosityAtTemp(params.fluidViscosity, params.temperatureC);

  return (
    <aside className="w-full lg:w-[350px] shrink-0 bg-white border-r border-sky-200/80 p-4 lg:p-5 flex flex-col gap-4 overflow-y-auto">
      {/* Simulation Playback Actions */}
      <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 shadow-2xs">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Drop Spheres (Falls from top when clicked!) */}
          <button
            onClick={onDropAll}
            type="button"
            className="col-span-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] text-white font-bold text-sm rounded-lg shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>{t.dropAllSpheres}</span>
          </button>

          <button
            onClick={onTogglePause}
            type="button"
            className={`py-2 px-3 border text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isAnyRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
            }`}
          >
            {isAnyRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>{t.pause}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{t.resume}</span>
              </>
            )}
          </button>

          <button
            onClick={onResetAll}
            type="button"
            className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.resetAllToTop}</span>
          </button>
        </div>

        {/* Slow-Motion Speed Control */}
        <div className="pt-2 border-t border-sky-200/60 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'bn' ? 'গতি (Slow-Mo)' : 'Speed'}:</span>
          </span>
          <div className="flex items-center gap-1">
            {[0.25, 0.5, 1.0].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangeParams((p) => ({ ...p, timeSpeed: spd }))}
                className={`px-2 py-0.5 text-[11px] font-bold rounded border transition-all cursor-pointer ${
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
      </div>

      {/* 3 Flasks Fluid Selection (Customizable for each flask!) */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          <Droplets className="w-4 h-4 text-emerald-600" />
          <span>{language === 'bn' ? '৩টি ফ্লাস্কের তরল কনফিগারেশন' : '3 Flask Fluid Selection'}</span>
        </div>
        <div className="space-y-2">
          {tubes.map((tube, idx) => (
            <div key={tube.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5" style={{ color: tube.lineColor }}>
                <span>{language === 'bn' ? tube.nameBn : tube.nameEn}</span>
                <span className="text-[10px] font-mono text-slate-500">
                  η = {tube.viscosity} Pa·s
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {FLUID_PRESETS.map((fl) => (
                  <button
                    key={fl.id}
                    type="button"
                    onClick={() => onChangeTubeFluid(idx, fl.id)}
                    className={`px-2 py-1 text-[11px] font-medium rounded border text-left truncate transition-all cursor-pointer ${
                      tube.fluidId === fl.id
                        ? 'bg-white border-emerald-500 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-500'
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {language === 'bn' ? fl.nameBn : fl.nameEn}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sphere Material Presets */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          <CircleDot className="w-4 h-4 text-emerald-600" />
          <span>{t.materialPresets}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MATERIAL_PRESETS.map((mat) => {
            const isSelected = selectedMaterialId === mat.id;
            return (
              <button
                key={mat.id}
                type="button"
                onClick={() => onSelectMaterial(mat.id)}
                className={`p-2 rounded-lg text-left border transition-all text-xs cursor-pointer ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50/60 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: mat.color }}
                  />
                  <span className="font-bold text-slate-900 truncate">
                    {language === 'bn' ? mat.nameBn : mat.nameEn}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  ρ = {mat.density} kg/m³
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Parameter Sliders (All Green Sliders as requested!) */}
      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <span>{t.customParams}</span>
        </div>

        <div className="space-y-3.5">
          {/* Sphere Radius Slider (GREEN) */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label className="text-slate-700 font-bold">{t.radiusLabel}</label>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                {params.radiusMm.toFixed(1)} mm
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.1"
              value={params.radiusMm}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChangeParams((p) => ({ ...p, radiusMm: val }));
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1.0 mm (r² impact)</span>
              <span>15.0 mm</span>
            </div>
          </div>

          {/* Sphere Density Slider (GREEN) */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label className="text-slate-700 font-bold">{t.sphereDensityLabel}</label>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                {params.sphereDensity} kg/m³
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max="12000"
              step="50"
              value={params.sphereDensity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChangeParams((p) => ({ ...p, sphereDensity: val }));
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1000 kg/m³</span>
              <span>12000 kg/m³</span>
            </div>
          </div>

          {/* Fluid Temperature Slider (GREEN) */}
          <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1 font-bold text-emerald-900">
                <Thermometer className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.tempLabel}</span>
              </div>
              <span className="font-mono font-bold text-emerald-900 bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]">
                {params.temperatureC}°C
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              step="1"
              value={params.temperatureC}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChangeParams((p) => ({ ...p, temperatureC: val }));
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="mt-1 pt-1 text-[10px] text-emerald-800 flex justify-between font-mono">
              <span>Higher temp = Lower liquid viscosity!</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
