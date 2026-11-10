import React from 'react';
import { FastForward, Globe, CheckCircle2, Gauge, Waves, Rocket, ArrowDownCircle } from 'lucide-react';
import { Language, SimulationState, ActiveStudioTab } from '../types';
import { TRANSLATIONS } from '../translations';

interface TopHeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  state: SimulationState;
  slowMo: boolean;
  onToggleSlowMo: () => void;
  onReset?: () => void;
  activeTab: ActiveStudioTab;
  onSelectTab: (tab: ActiveStudioTab) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  language,
  onToggleLanguage,
  state,
  slowMo,
  onToggleSlowMo,
  onReset,
  activeTab,
  onSelectTab,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-200 px-3 sm:px-6 py-2.5 shadow-xs w-full">
      <div className="w-full flex flex-wrap items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-sm shadow-sky-500/20 shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
              {t.appTitle}
            </h1>
            <p className="text-xs text-sky-700 font-medium hidden md:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => onSelectTab('terminal')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'terminal'
                ? 'bg-white text-blue-700 shadow-xs ring-1 ring-black/5 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>{t.tabTerminal}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('viscosity_shear')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'viscosity_shear'
                ? 'bg-white text-sky-700 shadow-xs ring-1 ring-black/5 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-sky-600" />
            <span>{t.tabNewtonViscosity}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('horizontal_stokes')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'horizontal_stokes'
                ? 'bg-white text-orange-700 shadow-xs ring-1 ring-black/5 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Rocket className="w-3.5 h-3.5 text-orange-600" />
            <span>{t.tabHorizontalStokes}</span>
          </button>
        </div>

        {/* Action Controls & Language Switcher */}
        <div className="flex items-center gap-2">
          {activeTab === 'terminal' && (
            <div className="hidden xl:flex items-center gap-1.5 mr-2">
              {state.isTerminalAchieved ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.terminalAchieved}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>{t.accelerating}</span>
                </div>
              )}
            </div>
          )}

          {/* Slow Motion Toggle */}
          <button
            onClick={onToggleSlowMo}
            type="button"
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              slowMo
                ? 'bg-sky-100 border-sky-400 text-sky-800 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle 0.5x Slow Motion"
          >
            <FastForward className="w-3.5 h-3.5 text-sky-600" />
            <span>{slowMo ? t.slowMo : t.normalSpeed}</span>
          </button>

          {/* Bilingual Toggle */}
          <button
            onClick={onToggleLanguage}
            type="button"
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-blue-700">{t.langToggle}</span>
          </button>

          {/* UDVASH Branding in Red (Replaced Reset button) */}
          <div className="px-3 py-1 flex items-center justify-center">
            <span className="text-base sm:text-lg font-black tracking-wider text-red-600 select-none uppercase font-sans">
              UDVASH
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
