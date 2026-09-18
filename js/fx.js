// ===== Lasers and explosions (pooled, no per-frame allocation) =====
import * as THREE from 'three';
import { COMBAT } from './config.js';
import { glowSprite } from './textures.js';

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class Lasers {
  constructor(scene, max = 48) {
    this.scene = scene;
    this.pool = [];
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 14, 6, 1, true);
    geo.rotateX(Math.PI / 2);   // point down -Z
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0x66ffcc, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.pool.push({ mesh, alive: false, life: 0, vel: new THREE.Vector3(), prev: new THREE.Vector3() });
    }
    this.cooldown = 0;
    this.shot = 0;
  }

  fire(ship, dt) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return false;
    const b = this.pool.find(p => !p.alive);
    if (!b) return false;
    this.cooldown = COMBAT.fireInterval;

    ship.muzzle(this.shot++, _v);
    b.mesh.position.copy(_v);
    b.prev.copy(_v);
    b.mesh.quaternion.copy(ship.group.quaternion);
    b.vel.copy(ship.forward).multiplyScalar(COMBAT.laserSpeed).addScaledVector(ship.velocity, 0.35);
    b.life = COMBAT.laserLife;
    b.alive = true;
    b.mesh.visible = true;
    b.mesh.scale.set(1, 1, 1);
    return true;
  }

  /**
   * Move bolts and test them against every target group.
   * Groups hold anything shaped like { pos, scale, alive } — rocks, fighters, capitals.
   * onHit(target, point) may return false to absorb the hit and keep the target alive.
   */
  update(dt, groups, onHit) {
    for (const b of this.pool) {
      if (!b.alive) continue;
      b.prev.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; b.mesh.visible = false; continue; }

      // swept sphere test against the segment prev -> pos
      _a.subVectors(b.mesh.position, b.prev);
      const segLen2 = _a.lengthSq() || 1;
      for (const group of groups) {
        if (!b.alive) break;
        for (const r of group) {
          if (!r.alive) continue;
          _b.subVectors(r.pos, b.prev);
          const t = THREE.MathUtils.clamp(_b.dot(_a) / segLen2, 0, 1);
          _v.copy(b.prev).addScaledVector(_a, t);
          const rad = r.scale + 7;
          if (_v.distanceToSquared(r.pos) < rad * rad) {
            b.alive = false;
            b.mesh.visible = false;
            if (onHit(r, _v) !== false) r.alive = false;
            break;
          }
        }
      }
    }
  }

  clear() { this.pool.forEach(b => { b.alive = false; b.mesh.visible = false; }); }
}

export class Explosions {
  constructor(scene, max = 26) {
    this.pool = [];
    const tex = glowSprite('rgba(255,235,190,1)', 'rgba(255,90,20,0)');
    for (let i = 0; i < max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      s.visible = false;
      scene.add(s);
      this.pool.push({ s, alive: false, t: 0, dur: 0.6, size: 40 });
    }
  }

  burst(pos, size = 40, dur = 0.6) {
    const e = this.pool.find(p => !p.alive);
    if (!e) return;
    e.s.position.copy(pos);
    e.alive = true; e.t = 0; e.dur = dur; e.size = size;
    e.s.visible = true;
  }

  update(dt) {
    for (const e of this.pool) {
      if (!e.alive) continue;
      e.t += dt;
      const k = e.t / e.dur;
      if (k >= 1) { e.alive = false; e.s.visible = false; continue; }
      e.s.scale.setScalar(e.size * (0.5 + k * 2.4));
      e.s.material.opacity = 1 - k * k;
    }
  }

  clear() { this.pool.forEach(e => { e.alive = false; e.s.visible = false; }); }
}
