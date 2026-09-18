// ===== The player's fighter: geometry, flight model, engine FX =====
import * as THREE from 'three';
import { FLIGHT } from './config.js';
import { glowSprite } from './textures.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Ship {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();          // position + orientation live here
    this.model = new THREE.Group();          // visual only, takes cosmetic bank
    this.group.add(this.model);
    scene.add(this.group);

    this.velocity = new THREE.Vector3();
    this.angular = new THREE.Vector3();      // pitch, yaw, roll rates (rad/s)
    this.throttle = 0.55;
    this.speed = FLIGHT.minSpeed;
    this.boostFuel = FLIGHT.boostMax;
    this.boosting = false;
    this.forward = new THREE.Vector3(0, 0, -1);

    this._build();
    this.reset();
  }

  // ---------------------------------------------------------------- model
  _build() {
    const hull = new THREE.MeshStandardMaterial({ color: 0xc9d4e2, metalness: 0.7, roughness: 0.35,
      emissive: 0x1a2740, emissiveIntensity: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3442, metalness: 0.6, roughness: 0.5,
      emissive: 0x0e1626, emissiveIntensity: 0.9 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff8a3d, metalness: 0.4, roughness: 0.45,
      emissive: 0x5a2400, emissiveIntensity: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a4f7a, metalness: 0.95, roughness: 0.08,
      emissive: 0x0a2b4a, emissiveIntensity: 0.9 });

    const add = (geo, mat, pos, rot, scale) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      if (scale) m.scale.set(...scale);
      this.model.add(m);
      return m;
    };

    // fuselage: nose cone + body + tail
    add(new THREE.ConeGeometry(0.62, 3.0, 14), hull, [0, 0, -3.3], [-Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.62, 0.78, 3.4, 14), hull, [0, 0, -0.2], [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.78, 0.55, 1.6, 14), dark, [0, 0, 2.2], [Math.PI / 2, 0, 0]);
    add(new THREE.BoxGeometry(0.5, 0.34, 3.0), accent, [0, 0.55, -0.4]);   // spine

    // cockpit canopy
    add(new THREE.SphereGeometry(0.52, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass,
        [0, 0.45, -1.15], [0, 0, 0], [1, 0.85, 2.1]);

    // delta wings — extruded so they catch the light from every angle
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -1.5);      // root, forward
    wingShape.lineTo(4.4, 1.55);    // swept tip, forward edge
    wingShape.lineTo(4.4, 2.15);    // tip, trailing edge
    wingShape.lineTo(0.2, 2.1);     // root, trailing edge
    wingShape.closePath();
    const wing = new THREE.ExtrudeGeometry(wingShape, { depth: 0.22, bevelEnabled: false });
    wing.translate(0, 0, -0.11);
    wing.rotateX(Math.PI / 2);      // lay it flat: shape Y becomes world Z
    const wl = new THREE.Mesh(wing, hull);
    wl.position.set(0.45, -0.05, 0.1);
    const wr = new THREE.Mesh(wing, hull);
    wr.position.set(-0.45, -0.05, 0.1);
    wr.scale.x = -1;
    hull.side = THREE.DoubleSide;   // mirrored wing has inverted winding
    this.model.add(wl, wr);

    // wing stripes + tips
    add(new THREE.BoxGeometry(2.2, 0.12, 0.42), accent, [2.4, 0.02, 1.15], [0, -0.18, 0]);
    add(new THREE.BoxGeometry(2.2, 0.12, 0.42), accent, [-2.4, 0.02, 1.15], [0, 0.18, 0]);
    add(new THREE.BoxGeometry(0.18, 0.72, 1.5), dark, [4.55, 0.3, 1.6], [0.2, 0, 0.12]);
    add(new THREE.BoxGeometry(0.18, 0.72, 1.5), dark, [-4.55, 0.3, 1.6], [0.2, 0, -0.12]);

    // tail fin + stabilisers
    add(new THREE.BoxGeometry(0.14, 1.3, 1.5), hull, [0, 0.85, 2.0], [0.35, 0, 0]);
    add(new THREE.BoxGeometry(1.9, 0.12, 0.8), hull, [0, 0.1, 2.5], [0.1, 0, 0]);

    // cannons
    this.gunTips = [];
    [-1.75, 1.75].forEach(x => {
      add(new THREE.CylinderGeometry(0.1, 0.13, 2.4, 8), dark, [x, -0.12, -1.0], [Math.PI / 2, 0, 0]);
      const tip = new THREE.Object3D();
      tip.position.set(x, -0.12, -2.3);
      this.model.add(tip);
      this.gunTips.push(tip);
    });

    // engines
    this.engines = [];
    [-0.85, 0.85].forEach(x => {
      add(new THREE.CylinderGeometry(0.42, 0.34, 2.2, 12), dark, [x, 0.0, 1.9], [Math.PI / 2, 0, 0]);
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite('rgba(180,240,255,1)', 'rgba(40,120,255,0)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      flare.position.set(x, 0, 3.15);
      flare.scale.setScalar(1.8);
      this.model.add(flare);
      this.engines.push(flare);

      const light = new THREE.PointLight(0x66ccff, 1.2, 26, 2);
      light.position.set(x, 0, 3.4);
      this.model.add(light);
      this.engines.push(light);
    });

    // navigation strobes
    this.strobes = [];
    [[4.7, 0x66ff88], [-4.7, 0xff5566]].forEach(([x, c]) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
        color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      s.position.set(x, 0.3, 1.7);
      s.scale.setScalar(0.9);
      this.model.add(s);
      this.strobes.push(s);
    });

    this.model.scale.setScalar(1.75);
  }

  // ---------------------------------------------------------------- state
  reset() {
    this.group.position.set(1620 + 180, 60, 420);   // just off Earth's orbit
    this.group.quaternion.identity();
    this.group.lookAt(0, 0, 0);
    this.group.rotateY(Math.PI);    // lookAt points +Z at the sun; the nose is -Z
    this.velocity.set(0, 0, 0);
    this.angular.set(0, 0, 0);
    this.throttle = 0.55;
    this.speed = FLIGHT.minSpeed;
    this.boostFuel = FLIGHT.boostMax;
    this.boosting = false;
    this.bank = 0;
    this.distance = 0;
  }

  get position() { return this.group.position; }

  /**
   * @param {number} dt seconds
   * @param {{pitch:number,yaw:number,roll:number,boost:boolean,brake:boolean,throttle:number}} input
   */
  update(dt, input) {
    const F = FLIGHT;

    // ---- rotation: input drives angular velocity, which decays toward it
    const targetPitch = input.pitch * F.pitchRate;
    const targetYaw = input.yaw * F.yawRate;
    const targetRoll = input.roll * F.rollRate - input.yaw * F.autoRoll;
    const k = 1 - Math.exp(-F.damping * dt);
    this.angular.x += (targetPitch - this.angular.x) * k;
    this.angular.y += (targetYaw - this.angular.y) * k;
    this.angular.z += (targetRoll - this.angular.z) * k;

    _q.setFromEuler(new THREE.Euler(this.angular.x * dt, this.angular.y * dt, this.angular.z * dt, 'XYZ'));
    this.group.quaternion.multiply(_q).normalize();

    // cosmetic bank so turns feel like flying, not sliding
    this.bank += (-input.yaw * 0.42 - this.bank) * (1 - Math.exp(-5 * dt));
    this.model.rotation.z = this.bank;
    this.model.rotation.x = input.pitch * 0.07;

    // ---- afterburner
    const wantBoost = input.boost && this.boostFuel > (this.boosting ? 0 : F.boostMinToStart);
    this.boosting = wantBoost;
    if (wantBoost) this.boostFuel = Math.max(0, this.boostFuel - F.boostDrain * dt);
    else this.boostFuel = Math.min(F.boostMax, this.boostFuel + F.boostRegen * dt);

    // ---- speed
    this.throttle = THREE.MathUtils.clamp(input.throttle ?? this.throttle, 0, 1);
    let target = F.minSpeed + (F.cruiseSpeed - F.minSpeed) * this.throttle;
    if (this.boosting) target = F.boostSpeed;
    if (input.brake) target = F.minSpeed * 0.35;
    const rate = (target < this.speed ? F.brakeAccel : F.accel) * (this.boosting ? 2.4 : 1);
    this.speed += THREE.MathUtils.clamp(target - this.speed, -rate * dt, rate * dt);

    this.forward.set(0, 0, -1).applyQuaternion(this.group.quaternion);
    this.velocity.copy(this.forward).multiplyScalar(this.speed);
    this.group.position.addScaledVector(this.velocity, dt);
    this.distance += this.speed * dt;

    this._updateFX(dt);
  }

  _updateFX(dt) {
    const t = performance.now() / 1000;
    const heat = THREE.MathUtils.clamp(this.speed / FLIGHT.cruiseSpeed, 0.15, 1) * (this.boosting ? 2.6 : 1);
    const flick = 1 + Math.sin(t * 40) * 0.06 + Math.sin(t * 17) * 0.04;
    for (let i = 0; i < this.engines.length; i += 2) {
      const flare = this.engines[i], light = this.engines[i + 1];
      flare.scale.set(1.5 * heat * flick, 1.5 * heat * flick, 1);
      flare.position.z = 3.15 + heat * 0.5;
      flare.material.color.setHSL(this.boosting ? 0.08 : 0.55, 1, this.boosting ? 0.62 : 0.72);
      light.intensity = 0.9 + heat * 1.8;
      light.color.setHSL(this.boosting ? 0.08 : 0.55, 1, 0.6);
    }
    const blink = (Math.sin(t * 3.2) > 0.85) ? 1.3 : 0.45;
    this.strobes.forEach(s => s.scale.setScalar(blink));
  }

  /** World-space muzzle positions, alternating barrels. */
  muzzle(i, out = new THREE.Vector3()) {
    return this.gunTips[i % this.gunTips.length].getWorldPosition(out);
  }

  /** Nudge the ship after a collision. */
  impulse(dir, amount) {
    this.group.position.addScaledVector(dir, amount);
    this.speed = Math.max(FLIGHT.minSpeed, this.speed * 0.45);
    this.angular.x += (Math.random() - 0.5) * 1.4;
    this.angular.z += (Math.random() - 0.5) * 1.8;
  }

  setVisible(v) { this.model.visible = v; }
}
