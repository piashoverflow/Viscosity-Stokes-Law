import { FluidPreset, MaterialPreset, SimulationParams } from './types';

export const FLUID_PRESETS: FluidPreset[] = [
  {
    id: 'water',
    nameEn: 'Water',
    nameBn: 'পানি',
    viscosity: 0.001002, // Pa·s at 20°C
    density: 1000,       // kg/m^3
    color: '#0284c7',    // Crystal Azure Blue
    fluidRgba: 'rgba(2, 132, 199, 0.28)',
    tempCoeff: 0.021,
  },
  {
    id: 'light_oil',
    nameEn: 'Light Oil / Olive Oil',
    nameBn: 'হালকা তেল / অলিভ অয়েল',
    viscosity: 0.081,    // Pa·s at 20°C
    density: 918,        // kg/m^3
    color: '#84cc16',    // Distinct Lime / Olive Gold
    fluidRgba: 'rgba(132, 204, 22, 0.36)',
    tempCoeff: 0.035,
  },
  {
    id: 'castor_oil',
    nameEn: 'Castor Oil',
    nameBn: 'রেড়ির তেল',
    viscosity: 0.985,    // Pa·s at 20°C
    density: 960,        // kg/m^3
    color: '#d97706',    // Warm Amber Gold
    fluidRgba: 'rgba(217, 119, 6, 0.42)',
    tempCoeff: 0.045,
  },
  {
    id: 'glycerin',
    nameEn: 'Glycerin',
    nameBn: 'গ্লিসারিন',
    viscosity: 1.49,     // Pa·s at 20°C
    density: 1260,       // kg/m^3
    color: '#0d9488',    // Distinct Viscous Jade / Emerald Teal
    fluidRgba: 'rgba(13, 148, 136, 0.38)',
    tempCoeff: 0.052,
  },
  {
    id: 'honey',
    nameEn: 'Honey',
    nameBn: 'মধু',
    viscosity: 10.0,     // Pa·s at 20°C
    density: 1420,       // kg/m^3
    color: '#9a3412',    // Deep Crimson Caramel Molasses
    fluidRgba: 'rgba(154, 52, 18, 0.65)',
    tempCoeff: 0.062,
  },
];

export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'tungsten_dark',
    nameEn: 'High-Contrast Dark Steel',
    nameBn: 'গাঢ় উচ্চ-কন্ট্রাস্ট স্টিল',
    density: 7850,
    color: '#0f172a',
    // Strong dark metallic look with high-contrast rim light
    sphereGradient: ['#e2e8f0', '#1e293b', '#020617'],
  },
  {
    id: 'heavy_lead',
    nameEn: 'Heavy Lead Sphere',
    nameBn: 'ভারী সীসার গোলক',
    density: 11340,
    color: '#020617',
    sphereGradient: ['#cbd5e1', '#334155', '#020617'],
  },
  {
    id: 'brass_golden',
    nameEn: 'Solid Brass Sphere',
    nameBn: 'পিতলের গোলক',
    density: 8500,
    color: '#854d0e',
    sphereGradient: ['#fef08a', '#ca8a04', '#451a03'],
  },
  {
    id: 'aluminum',
    nameEn: 'Aluminum',
    nameBn: 'অ্যালুমিনিয়াম',
    density: 2700,
    color: '#334155',
    sphereGradient: ['#ffffff', '#64748b', '#1e293b'],
  },
];

/**
 * Calculates effective fluid viscosity adjusted for temperature.
 */
export function calculateViscosityAtTemp(baseViscosity: number, tempC: number, tempCoeff = 0.04): number {
  const deltaT = tempC - 20;
  const factor = Math.exp(-tempCoeff * deltaT);
  return Math.max(0.0001, baseViscosity * factor);
}

/**
 * Terminal velocity: v_T = (2/9) * [r^2 * (rho - sigma) * g] / eta
 */
export function calculateTerminalVelocity(
  radiusMeters: number,
  sphereDensity: number,
  fluidDensity: number,
  viscosity: number,
  g = 9.8
): number {
  if (viscosity <= 0) return 0;
  const netDensity = sphereDensity - fluidDensity;
  if (netDensity <= 0) return 0;
  return (2 / 9) * (Math.pow(radiusMeters, 2) * netDensity * g) / viscosity;
}

/**
 * Reynolds number: Re = (2 * r * v * sigma) / eta
 */
export function calculateReynoldsNumber(
  radiusMeters: number,
  velocity: number,
  fluidDensity: number,
  viscosity: number
): number {
  if (viscosity <= 0) return 0;
  return (2 * radiusMeters * Math.abs(velocity) * fluidDensity) / viscosity;
}

export function getSpherePhysics(params: SimulationParams, currentTempViscosity: number) {
  const r = params.radiusMm * 1e-3;
  const volume = (4 / 3) * Math.PI * Math.pow(r, 3);
  const mass = params.sphereDensity * volume;
  const g = params.gravity;

  const weight = mass * g;
  const buoyancy = params.fluidDensity * volume * g;
  const vTerminal = calculateTerminalVelocity(
    r,
    params.sphereDensity,
    params.fluidDensity,
    currentTempViscosity,
    g
  );

  return {
    radiusMeters: r,
    volume,
    mass,
    weight,
    buoyancy,
    terminalVelocity: vTerminal,
  };
}

export function computeInstantaneousForces(
  velocity: number,
  params: SimulationParams,
  currentTempViscosity: number
) {
  const { radiusMeters, mass, weight, buoyancy, terminalVelocity } = getSpherePhysics(params, currentTempViscosity);
  const viscousDrag = 6 * Math.PI * currentTempViscosity * radiusMeters * velocity;
  const netForce = weight - buoyancy - viscousDrag;
  const acceleration = mass > 0 ? netForce / mass : 0;
  const reynoldsNumber = calculateReynoldsNumber(
    radiusMeters,
    velocity,
    params.fluidDensity,
    currentTempViscosity
  );

  return {
    weight,
    buoyancy,
    viscousDrag,
    netForce,
    acceleration,
    reynoldsNumber,
    isLaminar: reynoldsNumber < 2000,
    terminalVelocity,
  };
}

export function stepPhysicsRK4(
  currentY: number,
  currentV: number,
  dt: number,
  params: SimulationParams,
  currentTempViscosity: number
) {
  const { radiusMeters, mass, weight, buoyancy } = getSpherePhysics(params, currentTempViscosity);
  const dragCoeff = 6 * Math.PI * currentTempViscosity * radiusMeters;
  const netBuoyantWeight = weight - buoyancy;

  const accelFn = (v: number) => {
    const fNet = netBuoyantWeight - dragCoeff * v;
    return mass > 0 ? fNet / mass : 0;
  };

  const k1v = accelFn(currentV);
  const k2v = accelFn(currentV + 0.5 * dt * k1v);
  const k3v = accelFn(currentV + 0.5 * dt * k2v);
  const k4v = accelFn(currentV + dt * k3v);

  const newV = currentV + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);

  const k1y = currentV;
  const k2y = currentV + 0.5 * dt * k1v;
  const k3y = currentV + 0.5 * dt * k2v;
  const k4y = currentV + dt * k3v;

  const newY = currentY + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);

  return {
    positionY: Math.max(0, newY),
    velocity: Math.max(0, newV),
  };
}

// -------------------------------------------------------------
// Newton's Law of Viscosity (Surface Drag & Couette Flow)
// -------------------------------------------------------------
export function computeNewtonViscousDrag(
  plateVelocity: number,
  plateArea: number,
  fluidDepthMeters: number,
  viscosity: number
) {
  if (fluidDepthMeters <= 0) return { dragForce: 0, shearStress: 0, velocityGradient: 0, power: 0 };
  const velocityGradient = plateVelocity / fluidDepthMeters; // dv/dy (s^-1)
  const shearStress = viscosity * velocityGradient;          // tau = eta * dv/dy (Pa)
  const dragForce = shearStress * plateArea;                 // F = eta * A * (dv/dy) (N)
  const power = dragForce * plateVelocity;                   // Power = F * v (Watts)

  return {
    velocityGradient,
    shearStress,
    dragForce,
    power,
  };
}

// -------------------------------------------------------------
// Horizontal Stokes' Drag Motion
// -------------------------------------------------------------
export function computeHorizontalStokesTrajectory(
  v0x: number,
  radiusMeters: number,
  sphereDensity: number,
  fluidDensity: number,
  viscosity: number,
  hasGravity: boolean,
  dt: number,
  currentX: number,
  currentY: number,
  currentVx: number,
  currentVy: number
) {
  const volume = (4 / 3) * Math.PI * Math.pow(radiusMeters, 3);
  const mass = sphereDensity * volume;
  const dragCoeff = 6 * Math.PI * viscosity * radiusMeters;
  const k = mass > 0 ? dragCoeff / mass : 1;

  // Horizontal motion: F_x = -dragCoeff * vx => a_x = -k * vx
  const ax = -k * currentVx;
  const nextVx = Math.max(0, currentVx + ax * dt);
  const nextX = currentX + currentVx * dt;

  // Vertical motion:
  let ay = 0;
  let nextVy = currentVy;
  let nextY = currentY;

  const netBuoyantWeight = (mass - fluidDensity * volume) * 9.8;
  const vTy = dragCoeff > 0 ? netBuoyantWeight / dragCoeff : 0;

  if (hasGravity) {
    // Fy = netBuoyantWeight - dragCoeff * vy => ay = (netBuoyantWeight / mass) - k * vy
    const fNetY = netBuoyantWeight - dragCoeff * currentVy;
    ay = mass > 0 ? fNetY / mass : 0;
    nextVy = Math.max(0, currentVy + ay * dt);
    nextY = currentY + currentVy * dt;
  } else {
    // Zero gravity: no vertical motion
    ay = 0;
    nextVy = 0;
  }

  // Theoretical stopping distance if no gravity: x_stop = v0x / k
  const stoppingDistance = k > 0 ? v0x / k : 0;

  return {
    nextX,
    nextY,
    nextVx,
    nextVy,
    ax,
    ay,
    dragCoeff,
    k,
    stoppingDistance,
    verticalTerminalVel: vTy,
    dragForceX: dragCoeff * currentVx,
    dragForceY: dragCoeff * currentVy,
    speed: Math.hypot(nextVx, nextVy),
  };
}
