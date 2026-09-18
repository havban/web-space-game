// ===== Levels, missions, the two motherships, and the cargo you haul =====
// The Campaign owns every mission-scoped object. main.js drives it with update()
// and asks it what to draw on the HUD; it calls back out through `hooks`.
import * as THREE from 'three';
import { LEVELS, CAPITAL, CARGO, ENEMY, SCORE } from './config.js';
import { Squadron, EnemyBolts, Capital } from './entities.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class Campaign {
  /**
   * @param {object} hooks { toast, chime, boom, burst, shake, repair, refuel, score }
   */
  constructor(scene, world, hooks) {
    this.world = world;
    this.hooks = hooks;
    this.bolts = new EnemyBolts(scene);
    this.squadron = new Squadron(scene, this.bolts);
    this.station = new Capital(scene, { friendly: true, name: 'MOTHERSHIP' });
    this.base = new Capital(scene, { friendly: false, name: 'ENEMY MOTHERSHIP' });

    // an invisible proxy the nav readout can lock onto wherever the objective is
    this.marker = new THREE.Object3D();
    scene.add(this.marker);
    this.navEntry = { name: 'OBJECTIVE', mesh: this.marker, radius: 0, objective: true };

    this.levelIndex = 0;
    this.missionIndex = 0;
    this.mission = null;
    this.cargo = 0;
    this.leg = 'pickup';        // transport legs: pickup -> dropoff
    this.killsNeeded = 0;
    this.killsDone = 0;
    this.spawnedTotal = 0;
    this.docked = false;
    this.time = 0;
    this.finished = false;
  }

  get level() { return LEVELS[this.levelIndex]; }
  get levelCount() { return LEVELS.length; }

  // ---------------------------------------------------------------- setup
  /** Resolve a mission anchor ('EARTH' | 'STATION' | 'BASE') to a world position. */
  anchorPos(anchor, out = new THREE.Vector3()) {
    if (anchor === 'STATION') return out.copy(this.station.group.position);
    if (anchor === 'BASE') return out.copy(this.base.group.position);
    const body = this.world.bodies.find(b => b.name === anchor);
    return body ? this.world.bodyPosition(body, out) : out.set(0, 0, 0);
  }

  /** How close counts as "arrived" — planets need a wider net than a station. */
  anchorRadius(anchor) {
    if (anchor === 'STATION' || anchor === 'BASE') return CAPITAL.dockRadius * 1.4;
    const body = this.world.bodies.find(b => b.name === anchor);
    return Math.max(CARGO.radius, (body?.radius ?? 40) * 4.5);
  }

  /**
   * Park the mothership near this level's home planet and drop the player beside it.
   * @returns the world position the ship should start from.
   */
  startLevel(index, shipStart = new THREE.Vector3()) {
    this.levelIndex = THREE.MathUtils.clamp(index, 0, LEVELS.length - 1);
    this.finished = false;
    this.clearCombat();
    this.base.hide();

    const home = this.anchorPos(this.level.home, _v);
    // sit off the planet's sunward shoulder so it makes a nice backdrop
    _w.copy(home).normalize();
    const station = home.clone().addScaledVector(_w, 900).add(new THREE.Vector3(0, 220, 0));
    this.station.place(station, home);
    this.station.activate();

    shipStart.copy(station).addScaledVector(_w, 520).add(new THREE.Vector3(0, 60, 380));
    this.startMission(0);
    return shipStart;
  }

  startMission(index) {
    this.missionIndex = index;
    this.mission = this.level.missions[index];
    const m = this.mission;
    this.cargo = 0;
    this.leg = 'pickup';
    this.killsDone = 0;
    this.spawnedTotal = 0;
    this.killsNeeded = m.type === 'combat' ? m.count : 0;
    this.base.hide();

    if (m.type === 'combat') {
      this.squadron.spawn(this.hooks.shipPos(), Math.min(m.wave, m.count));
      this.spawnedTotal = this.squadron.liveCount;
    }
    if (m.type === 'assault') {
      const anchor = this.anchorPos(m.anchor, _v);
      _w.copy(anchor).normalize();
      // tuck it on the far side of the planet from the sun
      const at = anchor.clone().addScaledVector(_w, 1500).add(new THREE.Vector3(0, -180, 900));
      this.base.place(at, anchor);
      this.base.activate({ hull: m.hull, turrets: m.turrets, bolts: this.bolts });
      this.squadron.spawn(at, 3);
    }
    this.hooks.missionStart(m, index, this.level);
  }

  clearCombat() {
    this.squadron.clear();
    this.bolts.clear();
  }

  reset() {
    this.clearCombat();
    this.base.hide();
    this.station.hide();
    this.docked = false;
    this.cargo = 0;
    this.finished = false;
  }

  // ---------------------------------------------------------------- targets
  /** Everything the player's lasers can hit this frame, on top of the asteroids. */
  laserTargets(out = []) {
    out.length = 0;
    for (const e of this.squadron.list) if (e.alive) out.push(e);
    if (this.base.alive) {
      for (const t of this.base.liveTurrets()) out.push(t);
      out.push(this.base);
    }
    return out;
  }

  /**
   * Resolve a laser hit on one of our targets.
   * @returns false to keep the target alive (the bolt is spent either way).
   */
  onLaserHit(target, point, damage) {
    if (target.kind === 'enemy') {
      target.hull -= damage;
      if (target.hull > 0) return false;
      this.squadron.kill(target);
      this.hooks.burst(point, 46, 0.55);
      this.hooks.boom(1.1);
      this.hooks.score(ENEMY.score);
      this.onEnemyDown();
      return false;                     // we already hid it; don't let the pool null it out
    }

    if (target.kind === 'turret') {
      if (this.base.damageTurret(target, damage)) {
        this.hooks.burst(point, 40, 0.5);
        this.hooks.boom(0.9);
        this.hooks.score(400);
        const left = this.base.turretsLeft;
        this.hooks.toast(left ? `TURRET DOWN — ${left} LEFT` : 'TURRETS SILENCED — HIT THE CORE');
      }
      return false;
    }

    if (target.kind === 'base') {
      const shielded = this.base.turretsLeft > 0;
      if (this.base.damage(damage)) {
        this.destroyBase();
      } else if (shielded && Math.random() < 0.02) {
        this.hooks.toast('ARMOUR HOLDING — KILL THE TURRETS', true);
      }
      this.hooks.burst(point, shielded ? 14 : 26, 0.3);
      return false;
    }
    return false;
  }

  destroyBase() {
    const at = this.base.group.position.clone();
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        _v.copy(at).add(new THREE.Vector3(
          (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 380));
        this.hooks.burst(_v, 90 + Math.random() * 120, 0.9);
        this.hooks.boom(2);
      }, i * 160);
    }
    this.hooks.shake(1.3);
    this.hooks.score(5000);
    this.base.hide();
    this.completeMission('MOTHERSHIP DESTROYED');
  }

  onEnemyDown() {
    if (this.mission?.type !== 'combat') return;
    this.killsDone++;
    if (this.killsDone >= this.killsNeeded) { this.completeMission('AREA CLEAR'); return; }
    // trickle in replacements until the whole flight has been sent
    const remaining = this.killsNeeded - this.spawnedTotal;
    if (remaining > 0 && this.squadron.liveCount < this.mission.wave) {
      this.spawnedTotal += this.squadron.spawn(this.hooks.shipPos(), Math.min(remaining, this.mission.wave - this.squadron.liveCount));
    }
  }

  // ---------------------------------------------------------------- progress
  completeMission(reason) {
    this.hooks.score(SCORE.perMission);
    const last = this.missionIndex >= this.level.missions.length - 1;
    if (!last) {
      this.hooks.missionComplete(reason, this.mission);
      this.startMission(this.missionIndex + 1);
      return;
    }
    this.clearCombat();
    if (this.levelIndex >= LEVELS.length - 1) {
      this.finished = true;
      this.hooks.campaignComplete();
    } else {
      this.hooks.levelComplete(this.level, this.levelIndex);
    }
  }

  // ---------------------------------------------------------------- per frame
  update(dt, ship, invulnerable) {
    this.time += dt;
    const pos = ship.position;

    this.station.update(dt, pos, this.time);
    this.base.update(dt, pos, this.time);
    this.squadron.update(dt, pos, ship.velocity);

    this.bolts.update(dt, pos, 14, (dmg, point) => {
      if (this.docked || invulnerable) return;
      this.hooks.burst(point, 12, 0.22);
      this.hooks.damage(dmg, 'TAKING FIRE');
    });

    this._updateDocking(dt, ship);
    this._updateObjective(dt, ship);
  }

  _updateDocking(dt, ship) {
    if (!this.station.alive) { this.docked = false; return; }
    const d = ship.position.distanceTo(this.station.group.position);
    const near = d < CAPITAL.dockRadius && ship.speed < CAPITAL.dockSpeed;
    if (near && !this.docked) {
      this.docked = true;
      this.hooks.toast('DOCKED — REPAIRING');
      this.hooks.chime();
    } else if (!near && this.docked) {
      this.docked = false;
      this.hooks.toast('UNDOCKED — GOOD HUNTING');
    }
    if (this.docked) {
      this.hooks.repair(CAPITAL.repairRate * dt);
      this.hooks.refuel(CAPITAL.refuelRate * dt);
    }
    // tell the HUD when you're close but coming in too hot to latch on
    this.dockHint = !this.docked && d < CAPITAL.dockRadius * 1.9
      ? (ship.speed >= CAPITAL.dockSpeed ? 'SLOW TO DOCK' : 'DOCKING BAY AHEAD')
      : null;
  }

  _updateObjective(dt, ship) {
    const m = this.mission;
    if (!m) return;

    if (m.type === 'transport') {
      const anchor = this.leg === 'pickup' ? m.from : m.to;
      this.anchorPos(anchor, _v);
      this.marker.position.copy(_v);
      const reach = this.anchorRadius(anchor);
      if (ship.position.distanceTo(_v) < reach) {
        if (this.leg === 'pickup') {
          this.cargo = m.crates;
          this.leg = 'dropoff';
          this.hooks.cargoChanged(this.cargo);
          this.hooks.toast(`${m.crates} CRATE${m.crates > 1 ? 'S' : ''} ABOARD — RUN THEM TO ${m.to}`);
          this.hooks.chime();
          if (m.threat) this.squadron.spawn(ship.position, m.threat);
        } else {
          this.cargo = 0;
          this.hooks.cargoChanged(0);
          this.hooks.score(SCORE.perCrate * m.crates);
          this.completeMission('CARGO DELIVERED');
        }
      }
      return;
    }

    if (m.type === 'assault') {
      this.marker.position.copy(this.base.alive ? this.base.group.position : this.station.group.position);
      return;
    }

    // combat: point at the nearest live hostile, or the mothership if the sky is briefly clear
    let best = null, bestD = Infinity;
    for (const e of this.squadron.list) {
      if (!e.alive) continue;
      const d = e.pos.distanceToSquared(ship.position);
      if (d < bestD) { bestD = d; best = e; }
    }
    this.marker.position.copy(best ? best.pos : this.station.group.position);
  }

  // ---------------------------------------------------------------- hud
  hud() {
    const m = this.mission;
    if (!m) return null;
    let objective = '', progress = 0;
    if (m.type === 'transport') {
      objective = this.leg === 'pickup' ? `COLLECT CARGO AT ${m.from}` : `DELIVER TO ${m.to}`;
      progress = this.leg === 'pickup' ? 0 : 0.5;
    } else if (m.type === 'combat') {
      objective = `DESTROY HOSTILES  ${this.killsDone}/${this.killsNeeded}`;
      progress = this.killsDone / this.killsNeeded;
    } else {
      const t = this.base.turretsLeft;
      objective = t > 0 ? `KNOCK OUT TURRETS  ${this.base.turrets.length - t}/${this.base.turrets.length}`
                        : 'DESTROY THE CORE';
      progress = this.base.alive
        ? (t > 0 ? (this.base.turrets.length - t) / this.base.turrets.length * 0.5
                 : 0.5 + (1 - this.base.hull / this.base.hullMax) * 0.5)
        : 1;
    }
    return {
      level: this.levelIndex + 1, levelName: this.level.name,
      mission: this.missionIndex + 1, missionCount: this.level.missions.length,
      title: m.title, objective, progress: THREE.MathUtils.clamp(progress, 0, 1),
      cargo: this.cargo, docked: this.docked, dockHint: this.dockHint,
      hostiles: this.squadron.liveCount,
      bossHull: this.base.alive ? this.base.hull / this.base.hullMax : null,
    };
  }
}
