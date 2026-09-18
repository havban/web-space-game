// ===== Third-person chase camera with spring damping and speed FOV =====
import * as THREE from 'three';

const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _off = new THREE.Vector3();
const _up = new THREE.Vector3();
const _q = new THREE.Quaternion();

// chase / close / cinematic
const MODES = [
  { name: 'CHASE',  offset: new THREE.Vector3(0, 3.6, 13.5), look: 9,  stiff: 7.5,  fov: 68 },
  { name: 'CLOSE',  offset: new THREE.Vector3(0, 2.4, 9.0),  look: 12, stiff: 12.0, fov: 74 },
  { name: 'FAR',    offset: new THREE.Vector3(0, 6.5, 26),   look: 6,  stiff: 5.0,  fov: 62 },
];

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    this.shake = 0;
    this.pos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.initialised = false;
  }

  get modeName() { return MODES[this.mode].name; }
  cycle() { this.mode = (this.mode + 1) % MODES.length; return this.modeName; }

  addShake(amount) { this.shake = Math.min(1.4, this.shake + amount); }

  update(dt, ship) {
    const m = MODES[this.mode];
    const boostPull = ship.boosting ? 4.5 : 0;

    _off.copy(m.offset);
    _off.z += boostPull;
    _off.applyQuaternion(ship.group.quaternion);
    _target.copy(ship.position).add(_off);

    _look.set(0, 0, -m.look * 8).applyQuaternion(ship.group.quaternion).add(ship.position);

    if (!this.initialised) {
      this.pos.copy(_target); this.lookAt.copy(_look); this.initialised = true;
    } else {
      const k = 1 - Math.exp(-m.stiff * dt);
      this.pos.lerp(_target, k);
      this.lookAt.lerp(_look, 1 - Math.exp(-m.stiff * 1.6 * dt));
    }

    this.camera.position.copy(this.pos);

    // roll the camera with the ship so barrel rolls read properly
    _up.set(0, 1, 0).applyQuaternion(ship.group.quaternion);
    this.camera.up.lerp(_up, 1 - Math.exp(-6 * dt)).normalize();
    this.camera.lookAt(this.lookAt);

    if (this.shake > 0.001) {
      const s = this.shake * this.shake * 1.6;
      _q.setFromEuler(new THREE.Euler(
        (Math.random() - 0.5) * 0.04 * s,
        (Math.random() - 0.5) * 0.04 * s,
        (Math.random() - 0.5) * 0.06 * s));
      this.camera.quaternion.multiply(_q);
      this.camera.position.x += (Math.random() - 0.5) * s * 1.5;
      this.camera.position.y += (Math.random() - 0.5) * s * 1.5;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }

    // speed sells itself through FOV
    const boostFov = ship.boosting ? 16 : 0;
    const speedFov = (ship.speed / 1000) * 6;
    const wide = Math.min(1, innerWidth / innerHeight / 1.6);
    const targetFov = (m.fov + boostFov + speedFov) * (0.88 + 0.12 * wide);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }

  reset() { this.initialised = false; this.shake = 0; }
}
