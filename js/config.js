// ===== Tuning constants & solar system layout =====
// Distances are in "units" (u). The real solar system is compressed heavily so a
// pilot can cross it in a couple of minutes at boost instead of a couple of years.

export const FLIGHT = {
  cruiseSpeed: 260,      // u/s at full throttle
  boostSpeed: 1000,      // u/s with afterburner
  minSpeed: 40,          // engines always idle forward a little
  accel: 210,            // u/s^2 toward target speed
  brakeAccel: 420,
  pitchRate: 1.25,       // rad/s at full deflection
  yawRate: 0.95,
  rollRate: 2.1,
  autoRoll: 0.9,         // banking coupled into yaw input
  damping: 6.0,          // how fast angular velocity settles
  boostMax: 100,         // afterburner tank
  boostDrain: 34,        // per second
  boostRegen: 15,        // per second when off
  boostMinToStart: 12,
};

export const COMBAT = {
  laserSpeed: 2200,
  laserLife: 1.6,
  fireInterval: 0.13,
  laserDamage: 1,
  hullMax: 100,
  asteroidDamage: 26,
  sunDamagePerSec: 45,
  respawnInvuln: 2.0,
};

export const SUN = { radius: 300, lightIntensity: 4.2 };

// name, radius, orbit radius, orbit speed (rad/s), colours, tilt, extras
export const PLANETS = [
  { name:'MERCURY', radius:16,  orbit:820,   speed:0.050, colors:['#8c8378','#5b5147','#b5aa9b'], bands:7,  rough:1.0 },
  { name:'VENUS',   radius:30,  orbit:1180,  speed:0.037, colors:['#e6c27a','#c89a4e','#f4e0b0'], bands:5,  rough:0.5, atmo:'#ffd98a' },
  { name:'EARTH',   radius:33,  orbit:1620,  speed:0.030, colors:['#2f6fb5','#1d4f8f','#3f8f5a'], bands:4,  rough:0.7, atmo:'#6fb9ff', continents:true, moon:{ radius:9, orbit:95, speed:0.55, color:'#9a968f' } },
  { name:'MARS',    radius:22,  orbit:2120,  speed:0.024, colors:['#c1562f','#8f3a20','#e08a5c'], bands:6,  rough:0.85 },
  { name:'JUPITER', radius:98,  orbit:3550,  speed:0.014, colors:['#d8b48a','#a8794f','#f0dcc0','#8a5d3b'], bands:11, rough:0.35, atmo:'#e8c9a0' },
  { name:'SATURN',  radius:82,  orbit:4650,  speed:0.011, colors:['#e3cfa3','#c2a878','#f3e6c6'], bands:9,  rough:0.3, rings:{ inner:1.35, outer:2.35, color:'#d8c69a' }, tilt:0.47 },
  { name:'URANUS',  radius:52,  orbit:5750,  speed:0.008, colors:['#9fe3e3','#6fc4cc','#c6f2f0'], bands:5,  rough:0.25, atmo:'#a8eef0', tilt:1.7, rings:{ inner:1.5, outer:1.9, color:'#8fd5d8' } },
  { name:'NEPTUNE', radius:50,  orbit:6800,  speed:0.006, colors:['#3f66c4','#2a4a9c','#6f92e0'], bands:5,  rough:0.3, atmo:'#6f90ff' },
];

export const BELT = { inner:2550, outer:3050, count:{ low:420, medium:900, high:1500 }, thickness:130 };

// Loose rocks that spawn around the player so there is always something to dodge.
export const FIELD = { count:{ low:60, medium:110, high:170 }, radius:1500, minDist:320 };

export const QUALITY = {
  low:    { bloom:false, dpr:1.0,  stars:2600, shadows:false, sunDetail:32 },
  medium: { bloom:true,  dpr:1.35, stars:5200, shadows:false, sunDetail:48 },
  high:   { bloom:true,  dpr:2.0,  stars:9000, shadows:false, sunDetail:64 },
};

export const SCORE = { perAsteroid:100, perPlanetVisit:750, distanceDivisor:120 };
