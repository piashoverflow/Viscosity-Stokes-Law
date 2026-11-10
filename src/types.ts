export type Language = 'en' | 'bn';

export type ActiveStudioTab = 'terminal' | 'viscosity_shear' | 'horizontal_stokes';

export interface FluidPreset {
  id: string;
  nameEn: string;
  nameBn: string;
  viscosity: number; // Pa·s at 20°C
  density: number;   // kg/m^3
  color: string;     // CSS color
  fluidRgba: string; // rgba for canvas
  tempCoeff: number; // exponential temperature sensitivity coefficient
}

export interface MaterialPreset {
  id: string;
  nameEn: string;
  nameBn: string;
  density: number; // kg/m^3
  color: string;   // gradient / color representation
  sphereGradient: [string, string, string]; // highlight, mid, shadow
}

export interface SimulationParams {
  radiusMm: number;        // sphere radius in mm (1.0 to 25.0)
  sphereDensity: number;   // kg/m^3
  fluidViscosity: number;  // Pa·s at 20°C (Tube 1 default)
  fluidDensity: number;    // kg/m^3
  temperatureC: number;    // °C (10 to 80)
  timeSpeed: number;       // speed factor: 0.1x to 1.0x (to watch acceleration clearly!)
  gravity: number;         // 9.8 m/s^2
}

export interface SimulationState {
  time: number;          // seconds
  positionY: number;     // meters from top of fluid (0 to cylinderDepth)
  velocity: number;      // m/s downward
  acceleration: number;  // m/s^2
  weight: number;        // N
  buoyancy: number;      // N
  viscousDrag: number;   // N
  netForce: number;      // N
  terminalVelocity: number; // m/s
  reynoldsNumber: number;
  isLaminar: boolean;
  isTerminalAchieved: boolean;
  isRunning: boolean;
  hasReachedBottom: boolean;
  terminalPulse: number; // timestamp or intensity of pulse
}

export interface TelemetryPoint {
  time: number;
  velocity: number;
  acceleration: number;
  drag: number;
  netForce: number;
  positionY: number;
}

export interface TubeData {
  id: string;
  nameEn: string;
  nameBn: string;
  fluidId: string;
  fluidNameEn: string;
  fluidNameBn: string;
  viscosity: number; // Pa·s
  density: number;   // kg/m^3
  color: string;
  fluidRgba: string;
  lineColor: string; // Graph plot curve color
  state: SimulationState;
  history: TelemetryPoint[];
}

// Newton's Law of Viscosity (Surface Drag & Couette Shear Flow)
export interface ViscosityShearParams {
  plateVelocity: number;   // m/s (0.1 to 5.0)
  plateArea: number;       // m^2 (0.01 to 0.5)
  fluidDepthMm: number;    // mm (5 to 100 mm)
  fluidViscosity: number;  // Pa·s (0.001 to 5.0)
  isRunning: boolean;
}

// Horizontal Stokes' Drag Motion (With or Without Gravity)
export interface HorizontalStokesParams {
  initialSpeed: number;    // m/s (0.5 to 10.0)
  hasGravity: boolean;     // true: with gravity (curved trajectory); false: no gravity (retardation to stop)
  radiusMm: number;        // sphere radius (2 to 20 mm)
  sphereDensity: number;   // kg/m^3
  fluidViscosity: number;  // Pa·s
  fluidDensity: number;    // kg/m^3
  timeSpeed: number;       // 0.25x, 0.5x, 1.0x slow-mo
  isRunning: boolean;
}
