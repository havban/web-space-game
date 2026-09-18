// ===== Hostile fighters, capital ships, and the bolts they trade =====
// Everything here exposes { pos, scale, alive } so the existing laser sweep in
// fx.js can shoot at it without knowing what it is.
import * as THREE from 'three';
import { ENEMY, CAPITAL } from './config.js';
import { glowSprite } from './textures.js';

const _v = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, -1);

// ---------------------------------------------------------------- shared art
// One prototype, cloned per instance: clones share geometry and materials, so a
// full squadron costs almost nothing beyond its draw calls.
let PROTO = null;
function fighterPrototype() {
  if (PROTO) return PROTO;
  const hull = new THREE.MeshStandardMaterial({
    color: 0xa8414f, metalness: 0.6, roughness: 0.42,
    emissive: 0x6e1420, emissiveIntensity: 1.5, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x261a1e, metalness: 0.6, roughness: 0.55,
    emissive: 0x140708, emissiveIntensity: 0.9 });

  const g = new THREE.Group();
  const add = (geo, mat, pos, rot) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    g.add(m);
    return m;
  };

  add(new THREE.ConeGeometry(0.66, 3.2, 10), hull, [0, 0, -2.5], [-Math.PI / 2, 0, 0]);
  add(new THREE.CylinderGeometry(0.66, 0.56, 2.6, 10), hull, [0, 0, 0.1], [Math.PI / 2, 0, 0]);
  add(new THREE.SphereGeometry(0.4, 12, 8), dark, [0, 0.34, -0.7]);      // sensor blister

  // forward-swept wings — reads as "not ours" at a glance
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.4); shape.lineTo(3.3, -1.5); shape.lineTo(3.3, -0.85); shape.lineTo(0.25, 1.9);
  shape.closePath();
  const wing = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
  wing.rotateX(Math.PI / 2);
  const wl = new THREE.Mesh(wing, hull); wl.position.set(0.4, 0, 0.3);
  const wr = new THREE.Mesh(wing, hull); wr.position.set(-0.4, 0, 0.3); wr.scale.x = -1;
  g.add(wl, wr);
  add(new THREE.BoxGeometry(0.16, 0.6, 1.1), dark, [3.5, 0.16, -0.9]);
  add(new THREE.BoxGeometry(0.16, 0.6, 1.1), dark, [-3.5, 0.16, -0.9]);

  // twin engines
  [-0.7, 0.7].forEach(x => {
    add(new THREE.CylinderGeometry(0.34, 0.28, 1.8, 10), dark, [x, 0, 1.7], [Math.PI / 2, 0, 0]);
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,170,120,1)', 'rgba(255,40,0,0)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flare.position.set(x, 0, 2.7);
    flare.scale.setScalar(1.5);
    g.add(flare);
  });

  // threat light: the one part of a hostile you can pick out across a few hundred units
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite('rgba(255,90,80,1)', 'rgba(255,0,0,0)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  mark.position.set(0, 0.5, 0);
  mark.scale.setScalar(3.5);
  g.add(mark);

  g.scale.setScalar(3.2);
  PROTO = g;
  return g;
}

// ---------------------------------------------------------------- bolts
/** Red bolts fired at the player by fighters and turrets. */
export class EnemyBolts {
  constructor(scene, max = 72) {
    const geo = new THREE.CylinderGeometry(0.55, 0.55, 13, 6, 1, true);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5a4a, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false });
    this.pool = [];
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.pool.push({ mesh, alive: false, life: 0, dmg: 0, vel: new THREE.Vector3(), prev: new THREE.Vector3() });
    }
  }

  spawn(from, dir, damage, speed = ENEMY.boltSpeed, scale = 1) {
    const b = this.pool.find(p => !p.alive);
    if (!b) return;
    b.mesh.position.copy(from);
    b.prev.copy(from);
    b.mesh.scale.setScalar(scale);
    _m.lookAt(from, _v.copy(from).add(dir), UP);
    b.mesh.quaternion.setFromRotationMatrix(_m);
    b.vel.copy(dir).normalize().multiplyScalar(speed);
    b.dmg = damage;
    b.life = 2.6;
    b.alive = true;
    b.mesh.visible = true;
  }

  /** Sweep each bolt against the player sphere; onHit(damage, point) per strike. */
  update(dt, playerPos, playerRadius, onHit) {
    for (const b of this.pool) {
      if (!b.alive) continue;
      b.prev.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; b.mesh.visible = false; continue; }

      _v.subVectors(b.mesh.position, b.prev);
      const seg2 = _v.lengthSq() || 1;
      _aim.subVectors(playerPos, b.prev);
      const t = THREE.MathUtils.clamp(_aim.dot(_v) / seg2, 0, 1);
      _aim.copy(b.prev).addScaledVector(_v, t);
      if (_aim.distanceToSquared(playerPos) < playerRadius * playerRadius) {
        b.alive = false;
        b.mesh.visible = false;
        onHit(b.dmg, _aim);
      }
    }
  }

  clear() { this.pool.forEach(b => { b.alive = false; b.mesh.visible = false; }); }
}

// ---------------------------------------------------------------- fighters
export class Squadron {
  constructor(scene, bolts) {
    this.bolts = bolts;
    this.list = [];
    for (let i = 0; i < ENEMY.max; i++) {
      const obj = fighterPrototype().clone();
      obj.visible = false;
      scene.add(obj);
      this.list.push({
        obj, pos: obj.position, alive: false,
        hull: 0, cool: 0, breakT: 0, kind: 'enemy',
        scale: ENEMY.hitRadius,                    // what the laser sweep tests against
        offset: new THREE.Vector3(),
      });
    }
  }

  get liveCount() { return this.list.reduce((n, e) => n + (e.alive ? 1 : 0), 0); }

  /** Drop `count` fighters in a loose shell around `around`, facing it. */
  spawn(around, count) {
    let spawned = 0;
    for (const e of this.list) {
      if (spawned >= count) break;
      if (e.alive) continue;
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      e.pos.set(Math.cos(th) * s, u * 0.45, Math.sin(th) * s)
        .multiplyScalar(ENEMY.spawnDist * (0.75 + Math.random() * 0.5))
        .add(around);
      _m.lookAt(e.pos, around, UP);
      e.obj.quaternion.setFromRotationMatrix(_m);
      e.hull = ENEMY.hull;
      e.cool = 0.4 + Math.random() * 0.8;
      e.breakT = 0;
      e.alive = true;
      e.obj.visible = true;
      this._reoffset(e);
      spawned++;
    }
    return spawned;
  }

  _reoffset(e) {
    e.offset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize().multiplyScalar(90 + Math.random() * 220);
  }

  update(dt, playerPos, playerVel) {
    for (const e of this.list) {
      if (!e.alive) continue;

      _v.subVectors(playerPos, e.pos);
      const dist = _v.length();

      // too far to care about: fold them back in rather than let them wander off
      if (dist > ENEMY.leashDist) { this._reoffset(e); e.pos.copy(playerPos).addScaledVector(_v.normalize(), -ENEMY.spawnDist); }

      // break off after a close pass so they fly attack runs instead of sitting on your tail
      if (e.breakT > 0) {
        e.breakT -= dt;
        _aim.copy(playerPos).add(e.offset).addScaledVector(_v.normalize(), -900);
      } else {
        if (dist < ENEMY.breakRange) { e.breakT = 1.7; this._reoffset(e); }
        _aim.copy(playerPos).add(e.offset);
      }

      _m.lookAt(e.pos, _aim, UP);
      _q.setFromRotationMatrix(_m);
      e.obj.quaternion.rotateTowards(_q, ENEMY.turnRate * dt);

      _v.copy(FWD).applyQuaternion(e.obj.quaternion);
      e.pos.addScaledVector(_v, ENEMY.speed * dt);

      // shoot when roughly nose-on and inside range, leading the player's drift
      // test the cone against the lead point they'd actually shoot at: checking the raw
      // bearing instead meant the steering offset kept nudging them out of their own gate
      e.cool -= dt;
      if (e.cool <= 0 && e.breakT <= 0 && dist < ENEMY.fireRange) {
        const lead = dist / ENEMY.boltSpeed;
        _aim.copy(playerPos).addScaledVector(playerVel, lead).sub(e.pos).normalize();
        if (_aim.dot(_v) > ENEMY.fireCone) {
          this.bolts.spawn(e.pos, _aim, ENEMY.boltDamage);
          e.cool = ENEMY.fireInterval * (0.75 + Math.random() * 0.5);
        }
      }
    }
  }

  kill(e) { e.alive = false; e.obj.visible = false; }

  clear() { this.list.forEach(e => this.kill(e)); }
}

// ---------------------------------------------------------------- capitals
/**
 * A mothership. Friendly ones have a lit docking bay you fly into to repair;
 * hostile ones carry turrets that must fall before the core takes real damage.
 */
export class Capital {
  constructor(scene, { friendly, name }) {
    this.friendly = friendly;
    this.name = name;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.mesh = this.group;          // the nav readout projects this
    this.radius = CAPITAL.hitRadius;
    this.pos = this.group.position;  // laser sweep reads .pos
    this.scale = CAPITAL.hitRadius;
    this.kind = friendly ? 'station' : 'base';
    this.alive = false;
    this.hull = 0;
    this.hullMax = 1;
    this.turrets = [];
    this._build();
  }

  _build() {
    const f = this.friendly;
    const plate = new THREE.MeshStandardMaterial({
      color: f ? 0xa8b4c8 : 0x5e3c44, metalness: 0.55, roughness: 0.5,
      emissive: f ? 0x2e3f63 : 0x3a1018, emissiveIntensity: 1.15 });
    const dark = new THREE.MeshStandardMaterial({
      color: f ? 0x3a465c : 0x2b1a20, metalness: 0.55, roughness: 0.65,
      emissive: f ? 0x141d30 : 0x1a0808, emissiveIntensity: 1.0 });
    const lit = new THREE.MeshBasicMaterial({ color: f ? 0x66ffd0 : 0xff5a4a });

    const g = this.group;
    const add = (geo, mat, pos, rot, parent = g) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      parent.add(m);
      return m;
    };

    // spine and hull slabs — a 300u long slab of a ship
    add(new THREE.BoxGeometry(56, 34, 300), plate, [0, 0, 0]);
    add(new THREE.BoxGeometry(96, 18, 170), plate, [0, -6, 20]);
    add(new THREE.BoxGeometry(30, 44, 120), dark, [0, 20, 55]);         // superstructure
    add(new THREE.BoxGeometry(22, 24, 60), plate, [0, 44, 60]);          // bridge tower
    add(new THREE.ConeGeometry(28, 90, 6), plate, [0, 0, -190], [-Math.PI / 2, 0, 0]);  // prow

    // running lights down both flanks
    for (let i = -5; i <= 5; i++) {
      add(new THREE.BoxGeometry(2, 2, 8), lit, [29, 6, i * 24]);
      add(new THREE.BoxGeometry(2, 2, 8), lit, [-29, 6, i * 24]);
    }

    // engine bells
    [-30, 0, 30].forEach(x => {
      add(new THREE.CylinderGeometry(15, 19, 26, 12), dark, [x, 0, 158], [Math.PI / 2, 0, 0]);
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite(f ? 'rgba(150,220,255,1)' : 'rgba(255,150,90,1)',
                        f ? 'rgba(40,120,255,0)' : 'rgba(255,40,0,0)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      flare.position.set(x, 0, 176);
      flare.scale.setScalar(64);
      g.add(flare);
    });
    this.glow = g.children.filter(c => c.isSprite);

    // work lights: a capital this size should look inhabited, not like a hole in space
    [[0, 70, -60], [0, 70, 90]].forEach(([x, y, z]) => {
      const lamp = new THREE.PointLight(f ? 0x9fc4ff : 0xff8878, f ? 620 : 420, 620, 2);
      lamp.position.set(x, y, z);
      g.add(lamp);
    });

    if (f) {
      // docking bay: a lit ring you aim for, plus a beacon that pulses
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(46, 5, 10, 40),
        new THREE.MeshBasicMaterial({ color: 0x66ffd0, transparent: true, opacity: 0.85 }));
      ring.position.set(0, 0, -112);
      g.add(ring);
      this.dockRing = ring;
      add(new THREE.CylinderGeometry(44, 44, 40, 24, 1, true), dark, [0, 0, -92], [Math.PI / 2, 0, 0]);
      const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite('rgba(140,255,220,1)', 'rgba(0,180,140,0)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      beacon.position.set(0, 0, -112);
      beacon.scale.setScalar(150);
      g.add(beacon);
      this.beacon = beacon;
    }
  }

  /** Bolt `count` turrets onto a hostile hull. Called fresh for each assault. */
  _fitTurrets(count, bolts) {
    this.turrets.forEach(t => this.group.remove(t.obj));
    this.turrets = [];
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a2228, metalness: 0.7, roughness: 0.5, emissive: 0x2a0000, emissiveIntensity: 1.0 });
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -120 + Math.floor(i / 2) * (260 / Math.max(1, Math.ceil(count / 2) - 1 || 1));
      const obj = new THREE.Group();
      obj.position.set(side * 34, 20, THREE.MathUtils.clamp(z, -130, 130));
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4, 26, 8), mat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = -12;
      obj.add(new THREE.Mesh(new THREE.SphereGeometry(13, 12, 8), mat), barrel);
      this.group.add(obj);
      this.turrets.push({
        obj, alive: true, hull: CAPITAL.turretHull, cool: Math.random() * CAPITAL.turretInterval,
        kind: 'turret', scale: CAPITAL.turretRadius, pos: new THREE.Vector3(), capital: this,
        normal: new THREE.Vector3(side, 0.45, 0).normalize(),   // the arc it can cover
        arc: new THREE.Vector3(),
      });
    }
    this.bolts = bolts;
  }

  get turretsLeft() { return this.turrets.reduce((n, t) => n + (t.alive ? 1 : 0), 0); }

  /** Park the ship at `pos`, nose pointed at `face`. */
  place(pos, face) {
    this.group.position.copy(pos);
    _m.lookAt(pos, face, UP);
    this.group.quaternion.setFromRotationMatrix(_m);
    this.group.visible = true;
    this.alive = true;
  }

  activate({ hull = CAPITAL.baseHull, turrets = 0, bolts = null } = {}) {
    this.hull = this.hullMax = hull;
    if (!this.friendly) this._fitTurrets(turrets, bolts);
  }

  hide() { this.group.visible = false; this.alive = false; }

  /** @returns true when this hit finished it off. */
  damage(amount) {
    if (!this.alive) return false;
    const mult = this.turretsLeft > 0 ? CAPITAL.shielded : 1;
    this.hull -= amount * mult;
    if (this.hull <= 0) { this.hull = 0; return true; }
    return false;
  }

  damageTurret(t, amount) {
    t.hull -= amount;
    if (t.hull > 0) return false;
    t.alive = false;
    t.obj.visible = false;
    return true;
  }

  update(dt, playerPos, time) {
    if (!this.alive) return;
    if (this.friendly) {
      const p = 1 + Math.sin(time * 2.2) * 0.12;
      if (this.dockRing) this.dockRing.rotation.z += dt * 0.6;
      if (this.beacon) this.beacon.scale.setScalar(150 * p);
      return;
    }
    // turrets track and fire once the player is inside their envelope
    for (const t of this.turrets) {
      if (!t.alive) continue;
      t.obj.getWorldPosition(t.pos);
      const dist = t.pos.distanceTo(playerPos);
      if (dist > CAPITAL.turretRange) continue;
      // a turret bolted to the port flank cannot engage something off to starboard
      t.arc.copy(t.normal).applyQuaternion(this.group.quaternion);
      if (_v.subVectors(playerPos, t.pos).normalize().dot(t.arc) < -0.1) continue;
      // lookAt yields a world rotation; the turret hangs off the hull, so bring it local
      _m.lookAt(t.pos, playerPos, UP);
      _q.setFromRotationMatrix(_m);
      this.group.getWorldQuaternion(_qw).invert();
      t.obj.quaternion.slerp(_q.premultiply(_qw), 0.12);
      t.cool -= dt;
      if (t.cool <= 0) {
        _aim.subVectors(playerPos, t.pos).normalize();
        this.bolts?.spawn(t.pos, _aim, CAPITAL.turretDamage, CAPITAL.turretBoltSpeed, 1.6);
        t.cool = CAPITAL.turretInterval * (0.7 + Math.random() * 0.6);
      }
    }
  }

  /** World positions of live turrets, for the laser sweep. */
  liveTurrets() { return this.turrets.filter(t => t.alive); }
}
