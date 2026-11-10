import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Language,
  SimulationParams,
  SimulationState,
  TelemetryPoint,
  TubeData,
  ActiveStudioTab,
} from './types';
import {
  FLUID_PRESETS,
  MATERIAL_PRESETS,
  calculateViscosityAtTemp,
  computeInstantaneousForces,
  stepPhysicsRK4,
} from './physics';
import { TopHeader } from './components/TopHeader';
import { ControlSidebar } from './components/ControlSidebar';
import { CylinderCanvas } from './components/CylinderCanvas';
import { DynamicsGraphs } from './components/DynamicsGraphs';
import { DataCards } from './components/DataCards';
import { NewtonViscosityCanvas } from './components/NewtonViscosityCanvas';
import { HorizontalStokesCanvas } from './components/HorizontalStokesCanvas';

function createInitialState(
  fluidViscosity: number,
  fluidDensity: number,
  params: SimulationParams
): SimulationState {
  const currentVisc = calculateViscosityAtTemp(fluidViscosity, params.temperatureC);
  const tempParams = { ...params, fluidViscosity, fluidDensity };
  const forces = computeInstantaneousForces(0, tempParams, currentVisc);

  return {
    time: 0,
    positionY: 0,
    velocity: 0,
    acceleration: forces.acceleration,
    weight: forces.weight,
    buoyancy: forces.buoyancy,
    viscousDrag: 0,
    netForce: forces.netForce,
    terminalVelocity: forces.terminalVelocity,
    reynoldsNumber: 0,
    isLaminar: true,
    isTerminalAchieved: false,
    isRunning: false, // Default: stopped at the top, user drops on demand!
    hasReachedBottom: false,
    terminalPulse: 0,
  };
}

export default function App() {
  const [language, setLanguage] = useState<Language>('bn');
  const [activeTab, setActiveTab] = useState<ActiveStudioTab>('terminal');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('tungsten_dark');
  const [cylinderDepthMeters, setCylinderDepthMeters] = useState<number>(1.5);
  const [selectedFlaskIdx, setSelectedFlaskIdx] = useState<number>(0);

  // Common physical parameters
  const [params, setParams] = useState<SimulationParams>({
    radiusMm: 5.0,           // 5.0 mm radius
    sphereDensity: 7850,     // High-Contrast Dark Steel
    fluidViscosity: 0.081,   // Base fallback
    fluidDensity: 918,
    temperatureC: 20,        // 20°C
    timeSpeed: 0.5,          // 0.5x Slow-Motion by default for clear observation
    gravity: 9.8,
  });

  // 3 Tall Cylinders / Flasks with different fluids for simultaneous comparison
  const [tubes, setTubes] = useState<TubeData[]>(() => {
    const f1 = FLUID_PRESETS.find((f) => f.id === 'water') || FLUID_PRESETS[4];
    const f2 = FLUID_PRESETS.find((f) => f.id === 'light_oil') || FLUID_PRESETS[0];
    const f3 = FLUID_PRESETS.find((f) => f.id === 'castor_oil') || FLUID_PRESETS[1];

    const initialParams: SimulationParams = {
      radiusMm: 5.0,
      sphereDensity: 7850,
      fluidViscosity: 0.081,
      fluidDensity: 918,
      temperatureC: 20,
      timeSpeed: 0.5,
      gravity: 9.8,
    };

    return [
      {
        id: 'tube_1',
        nameEn: `Flask 1: ${f1.nameEn}`,
        nameBn: `ফ্লাস্ক ১: ${f1.nameBn}`,
        fluidId: f1.id,
        fluidNameEn: f1.nameEn,
        fluidNameBn: f1.nameBn,
        viscosity: f1.viscosity,
        density: f1.density,
        color: f1.color,
        fluidRgba: f1.fluidRgba,
        lineColor: f1.color,
        state: createInitialState(f1.viscosity, f1.density, initialParams),
        history: [],
      },
      {
        id: 'tube_2',
        nameEn: `Flask 2: ${f2.nameEn}`,
        nameBn: `ফ্লাস্ক ২: ${f2.nameBn}`,
        fluidId: f2.id,
        fluidNameEn: f2.nameEn,
        fluidNameBn: f2.nameBn,
        viscosity: f2.viscosity,
        density: f2.density,
        color: f2.color,
        fluidRgba: f2.fluidRgba,
        lineColor: f2.color,
        state: createInitialState(f2.viscosity, f2.density, initialParams),
        history: [],
      },
      {
        id: 'tube_3',
        nameEn: `Flask 3: ${f3.nameEn}`,
        nameBn: `ফ্লাস্ক ৩: ${f3.nameBn}`,
        fluidId: f3.id,
        fluidNameEn: f3.nameEn,
        fluidNameBn: f3.nameBn,
        viscosity: f3.viscosity,
        density: f3.density,
        color: f3.color,
        fluidRgba: f3.fluidRgba,
        lineColor: f3.color,
        state: createInitialState(f3.viscosity, f3.density, initialParams),
        history: [],
      },
    ];
  });

  const tubesRef = useRef(tubes);
  tubesRef.current = tubes;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const depthRef = useRef(cylinderDepthMeters);
  depthRef.current = cylinderDepthMeters;

  const animFrameId = useRef<number | null>(null);
  const lastTimestamp = useRef<number | null>(null);

  const isAnyRunning = tubes.some((t) => t.state.isRunning);

  // Drop All Spheres simultaneously from top
  const handleDropAll = useCallback(() => {
    const currentP = paramsRef.current;
    setTubes((prev) =>
      prev.map((tb) => {
        const currentVisc = calculateViscosityAtTemp(tb.viscosity, currentP.temperatureC);
        const tubeParams = { ...currentP, fluidViscosity: tb.viscosity, fluidDensity: tb.density };
        const forces = computeInstantaneousForces(0, tubeParams, currentVisc);

        const freshState: SimulationState = {
          time: 0,
          positionY: 0,
          velocity: 0,
          acceleration: forces.acceleration,
          weight: forces.weight,
          buoyancy: forces.buoyancy,
          viscousDrag: 0,
          netForce: forces.netForce,
          terminalVelocity: forces.terminalVelocity,
          reynoldsNumber: 0,
          isLaminar: true,
          isTerminalAchieved: false,
          isRunning: true,
          hasReachedBottom: false,
          terminalPulse: 0,
        };

        const initialPoint: TelemetryPoint = {
          time: 0,
          velocity: 0,
          acceleration: forces.acceleration,
          drag: 0,
          netForce: forces.netForce,
          positionY: 0,
        };

        return {
          ...tb,
          state: freshState,
          history: [initialPoint],
        };
      })
    );
    lastTimestamp.current = null;
  }, []);

  // Reset All Spheres to top (ready position, not moving)
  const handleResetAll = useCallback(() => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    lastTimestamp.current = null;

    const currentP = paramsRef.current;
    setTubes((prev) =>
      prev.map((tb) => {
        const currentVisc = calculateViscosityAtTemp(tb.viscosity, currentP.temperatureC);
        const tubeParams = { ...currentP, fluidViscosity: tb.viscosity, fluidDensity: tb.density };
        const forces = computeInstantaneousForces(0, tubeParams, currentVisc);

        return {
          ...tb,
          state: {
            time: 0,
            positionY: 0,
            velocity: 0,
            acceleration: forces.acceleration,
            weight: forces.weight,
            buoyancy: forces.buoyancy,
            viscousDrag: 0,
            netForce: forces.netForce,
            terminalVelocity: forces.terminalVelocity,
            reynoldsNumber: 0,
            isLaminar: true,
            isTerminalAchieved: false,
            isRunning: false,
            hasReachedBottom: false,
            terminalPulse: 0,
          },
          history: [],
        };
      })
    );
  }, []);

  // Toggle Pause / Resume
  const handleTogglePause = useCallback(() => {
    setTubes((prev) => {
      const anyActive = prev.some((t) => t.state.isRunning);
      return prev.map((tb) => {
        if (anyActive) {
          // Pause all
          return { ...tb, state: { ...tb.state, isRunning: false } };
        } else {
          // Resume those that have not reached bottom
          if (!tb.state.hasReachedBottom) {
            return { ...tb, state: { ...tb.state, isRunning: true } };
          }
          return tb;
        }
      });
    });
    lastTimestamp.current = null;
  }, []);

  // Change Fluid for a specific flask
  const handleChangeTubeFluid = useCallback((tubeIndex: number, fluidId: string) => {
    const f = FLUID_PRESETS.find((p) => p.id === fluidId);
    if (!f) return;

    // Immediately focus telemetry and cards on this flask
    setSelectedFlaskIdx(tubeIndex);

    setTubes((prev) =>
      prev.map((tb, idx) => {
        if (idx !== tubeIndex) return tb;
        const currentP = paramsRef.current;
        const currentVisc = calculateViscosityAtTemp(f.viscosity, currentP.temperatureC);
        const tubeParams = { ...currentP, fluidViscosity: f.viscosity, fluidDensity: f.density };
        const forces = computeInstantaneousForces(0, tubeParams, currentVisc);

        return {
          ...tb,
          nameEn: `Flask ${idx + 1}: ${f.nameEn}`,
          nameBn: `ফ্লাস্ক ${idx + 1}: ${f.nameBn}`,
          fluidId: f.id,
          fluidNameEn: f.nameEn,
          fluidNameBn: f.nameBn,
          viscosity: f.viscosity,
          density: f.density,
          color: f.color,
          fluidRgba: f.fluidRgba,
          lineColor: f.color,
          state: {
            time: 0,
            positionY: 0,
            velocity: 0,
            acceleration: forces.acceleration,
            weight: forces.weight,
            buoyancy: forces.buoyancy,
            viscousDrag: 0,
            netForce: forces.netForce,
            terminalVelocity: forces.terminalVelocity,
            reynoldsNumber: 0,
            isLaminar: true,
            isTerminalAchieved: false,
            isRunning: false,
            hasReachedBottom: false,
            terminalPulse: 0,
          },
          history: [],
        };
      })
    );
  }, []);

  // Select Sphere Material
  const handleSelectMaterial = useCallback((id: string) => {
    const m = MATERIAL_PRESETS.find((mat) => mat.id === id);
    if (!m) return;
    setSelectedMaterialId(id);
    setParams((prev) => ({
      ...prev,
      sphereDensity: m.density,
    }));

    // Recalculate static forces for all tubes
    setTubes((prev) =>
      prev.map((tb) => {
        const currentP = { ...paramsRef.current, sphereDensity: m.density };
        const currentVisc = calculateViscosityAtTemp(tb.viscosity, currentP.temperatureC);
        const tubeParams = { ...currentP, fluidViscosity: tb.viscosity, fluidDensity: tb.density };
        const forces = computeInstantaneousForces(0, tubeParams, currentVisc);

        return {
          ...tb,
          state: {
            ...tb.state,
            time: 0,
            positionY: 0,
            velocity: 0,
            acceleration: forces.acceleration,
            weight: forces.weight,
            buoyancy: forces.buoyancy,
            viscousDrag: 0,
            netForce: forces.netForce,
            terminalVelocity: forces.terminalVelocity,
            isRunning: false,
            hasReachedBottom: false,
          },
          history: [],
        };
      })
    );
  }, []);

  // Recalculate static physics when sliders (radius, temperature, density) change while paused
  useEffect(() => {
    const anyRunning = tubesRef.current.some((t) => t.state.isRunning);
    if (!anyRunning) {
      setTubes((prev) =>
        prev.map((tb) => {
          if (tb.state.velocity === 0) {
            const currentVisc = calculateViscosityAtTemp(tb.viscosity, params.temperatureC);
            const tubeParams = { ...params, fluidViscosity: tb.viscosity, fluidDensity: tb.density };
            const forces = computeInstantaneousForces(0, tubeParams, currentVisc);

            return {
              ...tb,
              state: {
                ...tb.state,
                weight: forces.weight,
                buoyancy: forces.buoyancy,
                viscousDrag: 0,
                netForce: forces.netForce,
                terminalVelocity: forces.terminalVelocity,
                acceleration: forces.acceleration,
              },
            };
          }
          return tb;
        })
      );
    }
  }, [params.radiusMm, params.sphereDensity, params.temperatureC]);

  // Main Multi-Tube Animation Loop using RK4
  useEffect(() => {
    if (activeTab !== 'terminal') return;

    if (!isAnyRunning) {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
        animFrameId.current = null;
      }
      return;
    }

    const loop = (timestamp: number) => {
      if (!lastTimestamp.current) {
        lastTimestamp.current = timestamp;
      }
      let rawDt = (timestamp - lastTimestamp.current) / 1000;
      lastTimestamp.current = timestamp;

      if (rawDt > 0.08) rawDt = 0.016;

      const timeScale = paramsRef.current.timeSpeed;
      const dt = rawDt * timeScale;
      const currentP = paramsRef.current;
      const maxDepth = depthRef.current;

      setTubes((prevTubes) =>
        prevTubes.map((tb) => {
          if (!tb.state.isRunning || tb.state.hasReachedBottom) {
            return tb;
          }

          const currentVisc = calculateViscosityAtTemp(tb.viscosity, currentP.temperatureC);
          const tubeParams = {
            ...currentP,
            fluidViscosity: tb.viscosity,
            fluidDensity: tb.density,
          };

          // Sub-step RK4 for numeric precision
          const subSteps = 4;
          const subDt = dt / subSteps;
          let nextY = tb.state.positionY;
          let nextV = tb.state.velocity;

          for (let s = 0; s < subSteps; s++) {
            const step = stepPhysicsRK4(nextY, nextV, subDt, tubeParams, currentVisc);
            nextY = step.positionY;
            nextV = step.velocity;
          }

          const nextTime = tb.state.time + dt;
          const forces = computeInstantaneousForces(nextV, tubeParams, currentVisc);

          const isTerminal =
            forces.terminalVelocity > 0 &&
            (Math.abs(forces.acceleration) < 0.05 || nextV >= 0.99 * forces.terminalVelocity);

          const reachedBottom = nextY >= maxDepth;
          let willKeepRunning = true;

          if (reachedBottom) {
            nextY = maxDepth;
            nextV = 0;
            willKeepRunning = false;
          }

          const updatedState: SimulationState = {
            time: nextTime,
            positionY: nextY,
            velocity: reachedBottom ? 0 : nextV,
            acceleration: reachedBottom ? 0 : forces.acceleration,
            weight: forces.weight,
            buoyancy: forces.buoyancy,
            viscousDrag: forces.viscousDrag,
            netForce: forces.netForce,
            terminalVelocity: forces.terminalVelocity,
            reynoldsNumber: forces.reynoldsNumber,
            isLaminar: forces.isLaminar,
            isTerminalAchieved: isTerminal,
            isRunning: willKeepRunning,
            hasReachedBottom: reachedBottom,
            terminalPulse:
              isTerminal && !tb.state.isTerminalAchieved ? Date.now() : tb.state.terminalPulse,
          };

          const newPoint: TelemetryPoint = {
            time: nextTime,
            velocity: nextV,
            acceleration: forces.acceleration,
            drag: forces.viscousDrag,
            netForce: forces.netForce,
            positionY: nextY,
          };

          const updatedHistory =
            tb.history.length > 450
              ? [...tb.history.slice(tb.history.length - 449), newPoint]
              : [...tb.history, newPoint];

          return {
            ...tb,
            state: updatedState,
            history: updatedHistory,
          };
        })
      );

      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isAnyRunning, activeTab]);

  const activeFlask = tubes[selectedFlaskIdx] || tubes[0];

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col font-sans selection:bg-sky-200 selection:text-sky-950">
      {/* Top Header with 3 Studio Navigation Tabs */}
      <TopHeader
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'bn' : 'en'))}
        state={activeFlask.state}
        slowMo={params.timeSpeed <= 0.4}
        onToggleSlowMo={() =>
          setParams((p) => ({ ...p, timeSpeed: p.timeSpeed <= 0.4 ? 1.0 : 0.5 }))
        }
        onReset={handleResetAll}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Workspace (Full Width, Zero Blank Waste on Left/Right) */}
      <main className="flex-1 w-full px-2 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">
        {/* Tab 1: Vertical Terminal Velocity Multi-Flask Studio */}
        {activeTab === 'terminal' && (
          <div className="w-full flex flex-col lg:flex-row items-stretch gap-4 bg-white border border-sky-200/80 rounded-2xl shadow-xs overflow-hidden">
            {/* Left Column: Control Sidebar (350px) */}
            <ControlSidebar
              language={language}
              params={params}
              onChangeParams={setParams}
              tubes={tubes}
              onChangeTubeFluid={handleChangeTubeFluid}
              onDropAll={handleDropAll}
              onTogglePause={handleTogglePause}
              onResetAll={handleResetAll}
              selectedMaterialId={selectedMaterialId}
              onSelectMaterial={handleSelectMaterial}
              isAnyRunning={isAnyRunning}
            />

            {/* Center Column: 3 Tall Cylinders Stage */}
            <CylinderCanvas
              language={language}
              params={params}
              tubes={tubes}
              cylinderDepthMeters={cylinderDepthMeters}
              zoomScale={cylinderDepthMeters}
              onChangeZoom={setCylinderDepthMeters}
              onDropAll={handleDropAll}
              onResetAll={handleResetAll}
              isAnyRunning={isAnyRunning}
            />

            {/* Right Column: Comparative Multi-Curve Dynamics Graphs & Data Cards */}
            <div className="w-full lg:w-[410px] shrink-0 p-4 bg-slate-50/50 flex flex-col gap-4 overflow-y-auto">
              <DynamicsGraphs language={language} tubes={tubes} />
              <DataCards
                language={language}
                params={params}
                state={activeFlask.state}
                tubes={tubes}
                selectedFlaskIdx={selectedFlaskIdx}
                onSelectFlaskIdx={setSelectedFlaskIdx}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Newton's Viscosity & Surface Drag Lab */}
        {activeTab === 'viscosity_shear' && (
          <NewtonViscosityCanvas language={language} />
        )}

        {/* Tab 3: Horizontal Stokes' Drag Motion (With vs Without Gravity) */}
        {activeTab === 'horizontal_stokes' && (
          <HorizontalStokesCanvas language={language} />
        )}
      </main>

      {/* Clean Scientific Footer */}
      <footer className="border-t border-sky-200/60 bg-white/90 py-3 text-center text-xs text-slate-500 w-full px-4">
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-slate-700">
            Viscosity, Stokes' Drag & Fluid Shear Dynamics Studio
          </span>
          <span className="font-mono text-slate-400">
            F = η·A·(dv/dy) · Fv = 6πηrv · vT = (2/9)r²(ρ - σ)g / η
          </span>
        </div>
      </footer>
    </div>
  );
}
