// ===== Solar Lancer — bootstrap, game loop, HUD, collisions, campaign flow =====
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { FLIGHT, COMBAT, QUALITY, SCORE, SUN, ENEMY, LEVELS } from './config.js';
import { World } from './world.js';
import { Ship } from './ship.js';
import { Input } from './input.js';
import { ChaseCamera } from './camera.js';
import { Lasers, Explosions } from './fx.js';
import { Audio } from './audio.js';
import { Campaign } from './missions.js';

const $ = id => document.getElementById(id);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();

const el = {
  canvas: $('scene'), hud: $('hud'), touch: $('touch'), pauseBtn: $('pause-btn'),
  menu: $('menu'), loading: $('loading'), menuMain: $('menu-main'), play: $('btn-play'),
  pauseMenu: $('pause-menu'), resume: $('btn-resume'), quit: $('btn-quit'),
  over: $('over-menu'), again: $('btn-again'), overTitle: $('over-title'), overSub: $('over-sub'),
  throttle: $('bar-throttle'), boost: $('bar-boost'), hull: $('bar-hull'),
  speed: $('r-speed'), score: $('r-score'), kills: $('r-kills'), hostiles: $('r-hostiles'),
  navName: $('nav-name'), navDist: $('nav-dist'),
  marker: $('nav-marker'), markerLabel: $('nav-marker-label'), arrow: $('nav-arrow'),
  toast: $('toast'), oScore: $('o-score'), oKills: $('o-kills'), oDist: $('o-dist'),
  quality: $('quality-seg'), rotate: $('rotate-hint'),
  // campaign
  mission: $('panel-mission'), mLevel: $('m-level'), mTitle: $('m-title'),
  mObjective: $('m-objective'), mProgress: $('m-progress'),
  cargoChip: $('cargo-chip'), cargoCount: $('cargo-count'), dockChip: $('dock-chip'),
  bossBar: $('boss-bar'), bossFill: $('boss-fill'),
  brief: $('brief-menu'), briefLevel: $('brief-level'), briefName: $('brief-name'),
  briefText: $('brief-text'), briefList: $('brief-list'), briefGo: $('btn-brief-go'),
  levelDone: $('level-menu'), lvlTitle: $('lvl-title'), lvlSub: $('lvl-sub'),
  lvlScore: $('lvl-score'), nextLevel: $('btn-next-level'),
};

// ---------------------------------------------------------------- quality
function detectQuality() {
  const saved = localStorage.getItem('sl_quality');
  if (saved && QUALITY[saved]) return saved;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && (mem <= 4 || cores <= 4)) return 'low';
  if (coarse) return 'medium';
  return cores >= 8 && mem >= 8 ? 'high' : 'medium';
}

const state = {
  mode: 'menu',            // menu | brief | playing | paused | over | debrief
  qualityName: detectQuality(),
  score: 0, kills: 0, invuln: 0, targetIndex: 0,
  lastTime: 0, hitFlash: 0, levelIndex: 0, levelScore: 0,
  hull: COMBAT.hullMax,
};

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({
  canvas: el.canvas, antialias: state.qualityName !== 'low', powerPreference: 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = null;
const camera = new THREE.PerspectiveCamera(68, 1, 0.6, 140000);
scene.add(camera);
// travels with the viewer: keeps the ship and near rocks readable when backlit
const fillLight = new THREE.PointLight(0xa8c8ff, 160, 900, 2);
fillLight.position.set(0, 6, 4);
camera.add(fillLight);

let quality = { ...QUALITY[state.qualityName], name: state.qualityName };
let composer = null, bloomPass = null;

const world = new World(scene, quality);
const ship = new Ship(scene);
const chase = new ChaseCamera(camera);
const lasers = new Lasers(scene);
const booms = new Explosions(scene);
const audio = new Audio();
const input = new Input({ onAction: handleAction });

const campaign = new Campaign(scene, world, {
  shipPos: () => ship.position,
  toast: (msg, danger) => toast(msg, danger),
  chime: () => audio.chime(),
  boom: s => audio.boom(s),
  burst: (p, s, d) => booms.burst(p, s, d),
  shake: s => chase.addShake(s),
  score: n => { state.score += n; },
  damage: (n, why) => damage(n, why, true),
  repair: n => { state.hull = Math.min(COMBAT.hullMax, state.hull + n); },
  refuel: n => { ship.boostFuel = Math.min(FLIGHT.boostMax, ship.boostFuel + n); },
  cargoChanged: n => ship.setCargo(n),
  missionStart, missionComplete, levelComplete, campaignComplete,
});
const _laserTargets = [];

function buildComposer() {
  if (composer) {
    composer.passes.forEach(pass => pass.dispose?.());   // bloom keeps its own render targets
    composer.dispose?.();
    composer = null; bloomPass = null;
  }
  if (!quality.bloom) return;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    quality.name === 'high' ? 0.85 : 0.6,   // strength
    0.75,                                    // radius
    0.72                                     // threshold
  );
  composer.addPass(bloomPass);
  composer.setPixelRatio(Math.min(devicePixelRatio, quality.dpr));
  composer.setSize(innerWidth, innerHeight);
}

function applyQuality(name) {
  state.qualityName = name;
  localStorage.setItem('sl_quality', name);
  quality = { ...QUALITY[name], name };
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.dpr));
  buildComposer();
  resize();
  [...el.quality.children].forEach(b => b.classList.toggle('on', b.dataset.q === name));
}

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.dpr));
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(Math.min(devicePixelRatio, quality.dpr)); composer.setSize(w, h); }
  el.rotate.style.display = (input.hasTouch && h > w && h < 520) ? 'flex' : 'none';
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 220));

// ---------------------------------------------------------------- nav targets
function navTargets() {
  const list = [campaign.navEntry, ...world.bodies.filter(b => !b.name.includes('MOON'))];
  if (campaign.station.alive) list.push(campaign.station);
  if (campaign.base.alive) list.push(campaign.base);
  return list;
}
function currentTarget() { const t = navTargets(); return t[state.targetIndex % t.length]; }

function cycleTarget(delta = 1) {
  const t = navTargets();
  state.targetIndex = (state.targetIndex + delta + t.length) % t.length;
  toast(`NAV LOCK: ${currentTarget().name}`);
  audio.chime();
}

function handleAction(action) {
  switch (action) {
    case 'target': if (state.mode === 'playing') cycleTarget(1); break;
    case 'camera': if (state.mode === 'playing') toast(`CAM: ${chase.cycle()}`); break;
    case 'pause':
      if (state.mode === 'playing') pause();
      else if (state.mode === 'paused') resumeGame();
      break;
    case 'restart': if (state.mode === 'over') beginLevel(state.levelIndex); break;
  }
}

let toastTimer = 0;
function toast(msg, danger = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('danger', danger);
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1800);
}

// ---------------------------------------------------------------- campaign flow
const MISSION_KIND = { transport: 'TRANSPORT', combat: 'COMBAT', assault: 'ASSAULT' };

function showBriefing(levelIndex) {
  state.levelIndex = levelIndex;
  state.mode = 'brief';
  const lv = LEVELS[levelIndex];
  el.briefLevel.textContent = `LEVEL ${levelIndex + 1} / ${LEVELS.length}`;
  el.briefName.textContent = lv.name;
  el.briefText.textContent = lv.brief;
  el.briefList.innerHTML = lv.missions
    .map(m => `<li><span class="tag">${MISSION_KIND[m.type]}</span><span>${m.title}</span></li>`)
    .join('');
  hideAllOverlays();
  el.brief.classList.remove('hidden');
  el.hud.classList.add('hidden');
  el.touch.classList.add('hidden');
  el.pauseBtn.classList.add('hidden');
}

function hideAllOverlays() {
  [el.menu, el.over, el.pauseMenu, el.brief, el.levelDone].forEach(o => o.classList.add('hidden'));
}

function missionStart(m, index, level) {
  state.targetIndex = 0;                        // snap the nav back to the objective
  toast(`MISSION ${index + 1}/${level.missions.length}: ${m.title}`);
  audio.chime();
}

function missionComplete(reason) {
  toast(`${reason} — OBJECTIVE COMPLETE`);
  audio.chime();
}

function levelComplete(level, levelIndex) {
  state.mode = 'debrief';
  el.lvlTitle.textContent = 'LEVEL CLEAR';
  el.lvlSub.textContent = `${level.name} secured. The next contract is already waiting.`;
  el.lvlScore.textContent = Math.round(state.score).toLocaleString();
  state.score += SCORE.perLevel;
  hideAllOverlays();
  el.levelDone.classList.remove('hidden');
  el.hud.classList.add('hidden');
  el.touch.classList.add('hidden');
  el.pauseBtn.classList.add('hidden');
  audio.silenceEngine();
  el.nextLevel.textContent = `LEVEL ${levelIndex + 2} ▸`;
  el.nextLevel.onclick = () => showBriefing(levelIndex + 1);
}

function campaignComplete() {
  gameOver('CAMPAIGN COMPLETE', 'Their mothership is a cloud of slag. The system is yours, lancer.', true);
}

// ---------------------------------------------------------------- game flow
function beginLevel(levelIndex) {
  state.levelIndex = levelIndex;
  state.mode = 'playing';
  state.invuln = COMBAT.respawnInvuln;
  state.hull = COMBAT.hullMax;
  state.targetIndex = 0;
  ship.reset();
  ship.setVisible(true);
  chase.reset();
  world.reset();
  lasers.clear();
  booms.clear();
  input.releaseAll();

  const start = campaign.startLevel(levelIndex, _v.clone());
  ship.placeAt(start, campaign.station.group.position);
  chase.reset();

  hideAllOverlays();
  el.hud.classList.remove('hidden');
  el.pauseBtn.classList.remove('hidden');
  el.touch.classList.toggle('hidden', !input.hasTouch);

  audio.init();
  audio.resume();
  state.lastTime = performance.now();
}

function startCampaign() {
  state.score = 0; state.kills = 0;
  showBriefing(0);
}

function pause() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  el.pauseMenu.classList.remove('hidden');
  input.releaseAll();
  audio.silenceEngine();
  audio.suspend();
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  el.pauseMenu.classList.add('hidden');
  audio.resume();
  state.lastTime = performance.now();
}

function gameOver(title, sub, victory = false) {
  state.mode = 'over';
  el.overTitle.textContent = title;
  el.overSub.textContent = sub;
  el.oScore.textContent = Math.round(state.score).toLocaleString();
  el.oKills.textContent = state.kills;
  el.oDist.textContent = Math.round(ship.distance / 1000).toLocaleString() + 'k';
  el.again.textContent = victory ? 'FLY AGAIN' : 'RETRY LEVEL';
  el.again.onclick = () => (victory ? startCampaign() : beginLevel(state.levelIndex));
  hideAllOverlays();
  el.over.classList.remove('hidden');
  el.hud.classList.add('hidden');
  el.pauseBtn.classList.add('hidden');
  el.touch.classList.add('hidden');
  campaign.clearCombat();
  if (!victory) {
    ship.setVisible(false);
    booms.burst(ship.position, 140, 1.2);
    audio.boom(2);
    chase.addShake(1.4);
  }
  audio.silenceEngine();
}

el.play.addEventListener('click', startCampaign);
el.briefGo.addEventListener('click', () => beginLevel(state.levelIndex));
el.resume.addEventListener('click', resumeGame);
el.quit.addEventListener('click', () => {
  state.mode = 'menu';
  campaign.reset();
  ship.setCargo(0);
  hideAllOverlays();
  el.menu.classList.remove('hidden');
  el.hud.classList.add('hidden');
  el.touch.classList.add('hidden');
  el.pauseBtn.classList.add('hidden');
  audio.silenceEngine();
});
el.pauseBtn.addEventListener('click', () => (state.mode === 'playing' ? pause() : resumeGame()));
el.quality.addEventListener('click', e => {
  const b = e.target.closest('button[data-q]');
  if (b) applyQuality(b.dataset.q);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- collisions
function checkCollisions(dt) {
  if (state.invuln > 0) state.invuln -= dt;

  const pos = ship.position;
  const shipR = 9;

  // planets, moons, the sun
  for (const b of world.bodies) {
    world.bodyPosition(b, _w);
    const d = pos.distanceTo(_w);

    if (b.isSun) {
      // the corona cooks you long before you touch the surface
      if (d < SUN.radius * 2.1) {
        const heat = 1 - (d - SUN.radius) / (SUN.radius * 1.1);
        damage(COMBAT.sunDamagePerSec * Math.max(0.15, heat) * dt, 'HULL TEMPERATURE CRITICAL', true);
        chase.addShake(0.02);
      }
    }

    if (d < b.radius + shipR) {
      _v.subVectors(pos, _w).normalize();
      ship.impulse(_v, (b.radius + shipR) - d + 2);
      damage(b.isSun ? 100 : COMBAT.asteroidDamage * 1.6, `IMPACT: ${b.name}`, true);
      chase.addShake(0.9);
    }

    // score for close flybys of each planet
    if (!b.isSun && !b.visited && d < b.radius * 4.5) {
      b.visited = true;
      state.score += SCORE.perPlanetVisit;
      toast(`${b.name} SURVEYED  +${SCORE.perPlanetVisit}`);
      audio.chime();
    }
  }

  // capital ships — you bounce off your own mothership, you bleed on theirs
  for (const cap of [campaign.station, campaign.base]) {
    if (!cap.alive) continue;
    const d = pos.distanceTo(cap.group.position);
    if (d < cap.radius + shipR) {
      _v.subVectors(pos, cap.group.position).normalize();
      ship.impulse(_v, (cap.radius + shipR) - d + 3);
      chase.addShake(0.7);
      if (!cap.friendly) damage(COMBAT.asteroidDamage * 1.4, `IMPACT: ${cap.name}`, true);
      else toast('MIND THE PAINT', true);
    }
  }

  // enemy fighters — ramming hurts both of you, but it hurts them more
  for (const e of campaign.squadron.list) {
    if (!e.alive) continue;
    const rad = ENEMY.hitRadius + shipR;
    if (pos.distanceToSquared(e.pos) < rad * rad) {
      campaign.squadron.kill(e);
      booms.burst(e.pos, 52, 0.6);
      audio.boom(1.3);
      _v.subVectors(pos, e.pos).normalize();
      ship.impulse(_v, rad);
      damage(ENEMY.rammingDamage, 'COLLISION: HOSTILE FIGHTER', true);
      chase.addShake(0.9);
      state.score += ENEMY.score * 0.5;
      campaign.onEnemyDown();
    }
  }

  // asteroids
  for (const r of world.asteroids) {
    if (!r.alive) continue;
    const rad = r.scale + shipR;
    if (pos.distanceToSquared(r.pos) < rad * rad) {
      r.alive = false;
      booms.burst(r.pos, r.scale * 2.4, 0.5);
      audio.boom(Math.min(1.6, r.scale / 18));
      _v.subVectors(pos, r.pos).normalize();
      ship.impulse(_v, rad);
      damage(COMBAT.asteroidDamage, 'ASTEROID IMPACT', true);
      chase.addShake(0.7);
      setTimeout(() => world.respawnRock(r, ship.position), 4000);
    }
  }
}

function damage(amount, reason, flash) {
  if (state.invuln > 0 || state.mode !== 'playing' || campaign.docked) return;
  state.hull -= amount;
  if (flash) {
    state.hitFlash = 0.18;
    if (amount > 5) audio.alarm();
  }
  if (amount > 5) toast(reason, true);
  if (state.hull <= 0) {
    state.hull = 0;
    gameOver('HULL BREACH', reason + ' — your lancer is space dust.');
  }
}

// ---------------------------------------------------------------- HUD
let hudAccum = 0;
function updateHUD(dt) {
  el.hud.classList.toggle('boosting', ship.boosting);
  el.hud.classList.toggle('hit', state.hitFlash > 0);
  if (state.hitFlash > 0) state.hitFlash -= dt;

  hudAccum += dt;
  const target = currentTarget();
  world.bodyPosition(target, _w);
  const dist = ship.position.distanceTo(_w);

  // cheap bars every frame, text at 12fps to keep layout thrash down
  el.throttle.style.width = (ship.speed / FLIGHT.boostSpeed * 100) + '%';
  el.boost.style.width = (ship.boostFuel / FLIGHT.boostMax * 100) + '%';
  const hullPct = state.hull / COMBAT.hullMax * 100;
  el.hull.style.width = hullPct + '%';
  el.hull.className = hullPct < 25 ? 'crit' : hullPct < 55 ? 'warn' : '';

  const m = campaign.hud();

  if (hudAccum > 0.08) {
    hudAccum = 0;
    el.speed.textContent = Math.round(ship.speed);
    el.score.textContent = Math.round(state.score).toLocaleString();
    el.kills.textContent = state.kills;
    el.navName.textContent = target.name;
    el.navDist.textContent = dist > 9999
      ? (dist / 1000).toFixed(1) + 'k u'
      : Math.round(dist) + ' u';

    if (m) {
      el.hostiles.textContent = m.hostiles;
      el.mLevel.textContent = `LVL ${m.level}·${m.levelName}  ·  ${m.mission}/${m.missionCount}`;
      el.mTitle.textContent = m.title;
      el.mObjective.textContent = m.objective;
      el.mProgress.style.width = (m.progress * 100) + '%';
      el.cargoChip.classList.toggle('hidden', !m.cargo);
      el.cargoCount.textContent = m.cargo;
      el.dockChip.classList.toggle('hidden', !(m.docked || m.dockHint));
      el.dockChip.textContent = m.docked ? 'DOCKED — REPAIRING' : (m.dockHint || '');
      el.dockChip.classList.toggle('active', !!m.docked);
      el.bossBar.classList.toggle('hidden', m.bossHull === null);
      if (m.bossHull !== null) el.bossFill.style.width = (m.bossHull * 100) + '%';
    }
  }

  // project the target onto the screen
  _p.copy(_w).project(camera);
  const onScreen = _p.z < 1 && Math.abs(_p.x) < 1 && Math.abs(_p.y) < 1;
  if (onScreen) {
    el.marker.style.display = 'flex';
    el.arrow.style.display = 'none';
    el.marker.style.transform =
      `translate(${(_p.x * 0.5 + 0.5) * innerWidth}px, ${(-_p.y * 0.5 + 0.5) * innerHeight}px)`;
    el.markerLabel.textContent = target.name;
  } else {
    el.marker.style.display = 'none';
    el.arrow.style.display = 'block';
    // point the arrow at the off-screen target
    _v.copy(_w).sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    const ang = Math.atan2(_v.x, -_v.y) * (_v.z > 0 ? -1 : 1);
    const r = Math.min(innerWidth, innerHeight) * 0.28;
    el.arrow.style.transform =
      `translate(${Math.sin(ang) * r}px, ${-Math.cos(ang) * r}px) rotate(${ang}rad)`;
  }
}

// ---------------------------------------------------------------- loop
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - state.lastTime) / 1000) || 0;
  state.lastTime = now;

  if (state.mode === 'playing') {
    const cmd = input.sample(dt);
    ship.update(dt, cmd);

    if (cmd.fire && lasers.fire(ship, dt)) audio.laser();

    campaign.laserTargets(_laserTargets);
    lasers.update(dt, [world.asteroids, _laserTargets], (target, point) => {
      if (target.kind) return campaign.onLaserHit(target, point, COMBAT.boltDamage);
      state.kills++;
      state.score += SCORE.perAsteroid;
      booms.burst(point, target.scale * 2.2, 0.45);
      audio.boom(Math.min(1.5, target.scale / 20));
      setTimeout(() => world.respawnRock(target, ship.position), 3500);
    });

    world.update(dt, ship.position);
    campaign.update(dt, ship, state.invuln > 0);
    booms.update(dt);
    checkCollisions(dt);
    chase.update(dt, ship);
    state.score += ship.speed * dt / SCORE.distanceDivisor;
    audio.engine(Math.min(1, ship.speed / FLIGHT.cruiseSpeed), ship.boosting);
    updateHUD(dt);
  } else {
    // menus still get a slowly drifting view of the system
    world.update(dt * 0.35, ship.position);
    booms.update(dt);
    if (state.mode === 'paused') {
      chase.update(dt * 0.15, ship);
    } else {
      const t = now / 1000;
      camera.position.set(Math.cos(t * 0.06) * 2400, 700 + Math.sin(t * 0.09) * 300, Math.sin(t * 0.06) * 2400);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.fov += (62 - camera.fov) * 0.05;
      camera.updateProjectionMatrix();
    }
  }

  if (composer) composer.render(); else renderer.render(scene, camera);
}

// ---------------------------------------------------------------- boot
function boot() {
  applyQuality(state.qualityName);
  resize();
  // draw one frame so the menu backdrop isn't black while textures settle
  renderer.render(scene, camera);
  el.loading.classList.add('hidden');
  el.menuMain.classList.remove('hidden');
  state.lastTime = performance.now();
  requestAnimationFrame(frame);
}

// expose a little for debugging / smoke tests
window.__game = {
  state, ship, world, camera, renderer, campaign, chase, lasers, applyQuality,
  startGame: startCampaign, beginLevel, showBriefing,
};

boot();
