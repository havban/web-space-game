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

export const SCORE = { perAsteroid:100, perPlanetVisit:750, distanceDivisor:120,
  perMission:1500, perCrate:600, perLevel:4000 };

// ===== Combatants =====

export const ENEMY = {
  hull: 14, speed: 300, turnRate: 1.15,
  fireRange: 950, fireInterval: 0.85, boltSpeed: 1500, boltDamage: 7, fireCone: 0.93,
  engageRange: 3200, breakRange: 320, hitRadius: 23,
  score: 300, max: 16, spawnDist: 1800, leashDist: 7000,
  rammingDamage: 34,
};

// Both motherships are the same hull class; only the paint and the guns differ.
export const CAPITAL = {
  hitRadius: 170,                  // you will bounce off anything closer than this
  // friendly side
  dockRadius: 320, dockSpeed: 240, repairRate: 26, refuelRate: 55,
  // hostile side
  baseHull: 420, shielded: 0.22,   // damage multiplier while any turret still stands
  turretHull: 22, turretRadius: 30, turretRange: 1400,
  turretInterval: 2.4, turretDamage: 8, turretBoltSpeed: 1250,
};

export const CARGO = { radius: 340, dragFactor: 0.86 };

// Player bolts do flat damage to ships; rocks still die in one hit.
COMBAT.boltDamage = 4;

// ===== Campaign =====
// Each level parks the mothership near `home` and strings together a few missions.
// Mission anchors resolve to a planet name, or 'STATION' / 'BASE' for the capitals.

export const LEVELS = [
  {
    name: 'SHAKEDOWN',
    home: 'EARTH',
    brief: 'Fresh out of the yard. Run a crate to the Mars garrison, then swat the scavengers ' +
           'that followed you home. Dock with the mothership any time to patch your hull.',
    missions: [
      { type: 'transport', title: 'SUPPLY RUN', from: 'STATION', to: 'MARS', crates: 1, threat: 0 },
      { type: 'combat', title: 'SCAVENGER SWEEP', count: 4, wave: 2 },
    ],
  },
  {
    name: 'BELT PATROL',
    home: 'MARS',
    brief: 'Raiders are picking off ore convoys inside the belt. Clear the lane, then haul the ' +
           'ore out to the Jovian smelters yourself.',
    missions: [
      { type: 'combat', title: 'CLEAR THE LANE', count: 6, wave: 3 },
      { type: 'transport', title: 'ORE HAUL', from: 'STATION', to: 'JUPITER', crates: 2, threat: 2 },
    ],
  },
  {
    name: 'FIRST STRIKE',
    home: 'JUPITER',
    brief: 'Scouts found a raider staging post hiding in Jupiter\'s shadow. Burn off its screen, ' +
           'knock out the turrets, then put the hulk down.',
    missions: [
      { type: 'combat', title: 'SCREEN THE APPROACH', count: 6, wave: 3 },
      { type: 'assault', title: 'KILL THE STAGING POST', anchor: 'JUPITER', hull: 420, turrets: 6 },
    ],
  },
  {
    name: 'DEEP WATER',
    home: 'SATURN',
    brief: 'The ring crews are stranded and the blockade is tightening. Get them out, hold the ' +
           'gap while they run, and break whatever is sitting on the rings.',
    missions: [
      { type: 'transport', title: 'EVACUATE THE RING CREWS', from: 'SATURN', to: 'STATION', crates: 2, threat: 3 },
      { type: 'combat', title: 'HOLD THE GAP', count: 8, wave: 4 },
      { type: 'assault', title: 'BREAK THE BLOCKADE', anchor: 'SATURN', hull: 520, turrets: 7 },
    ],
  },
  {
    name: 'THE OUTER DARK',
    home: 'NEPTUNE',
    brief: 'Their mothership is out past Neptune where the sun is just another star. Cut the ' +
           'picket, run the warheads up to the Uranus battery, and finish this.',
    missions: [
      { type: 'combat', title: 'CUT THE PICKET', count: 9, wave: 4 },
      { type: 'transport', title: 'RUN THE WARHEADS OUT', from: 'STATION', to: 'URANUS', crates: 2, threat: 4 },
      { type: 'assault', title: 'DESTROY THE MOTHERSHIP', anchor: 'NEPTUNE', hull: 680, turrets: 8 },
    ],
  },
];
