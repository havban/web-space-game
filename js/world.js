// ===== The solar system: sun, planets, moons, rings, asteroids, stars =====
import * as THREE from 'three';
import { PLANETS, SUN, BELT, FIELD } from './config.js';
import { planetTexture, sunTexture, glowSprite, ringTexture } from './textures.js';

const V = new THREE.Vector3();
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3(1, 1, 1);

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.bodies = [];       // { name, mesh, radius, group } — everything you can crash into
    this.asteroids = [];    // { pos, radius, rot, spin, alive, scale, idx }
    this.time = 0;

    this._buildLights();
    this._buildStars();
    this._buildSun();
    this._buildPlanets();
    this._buildBelt();
    this._buildLocalRocks();
  }

  // ---------------------------------------------------------------- lighting
  _buildLights() {
    this.sunLight = new THREE.PointLight(0xffe0b0, SUN.lightIntensity, 0, 0.0);
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x2a3a5c, 0.55));
    // a dim rim light so ships/rocks never go fully black on the dark side
    const rim = new THREE.DirectionalLight(0x5577aa, 0.35);
    rim.position.set(-1, 0.6, -1);
    this.scene.add(rim);
  }

  // ---------------------------------------------------------------- stars
  _buildStars() {
    const count = this.quality.stars;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // uniform on a sphere shell
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u), R = 42000 + Math.random() * 6000;
      pos[i * 3] = Math.cos(th) * r * R;
      pos[i * 3 + 1] = u * R;
      pos[i * 3 + 2] = Math.sin(th) * r * R;
      const t = Math.random();
      c.setHSL(t < 0.75 ? 0.58 + Math.random() * 0.08 : 0.07 + Math.random() * 0.05,
               0.25 + Math.random() * 0.5, 0.55 + Math.random() * 0.45);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      sz[i] = 1.0 + Math.pow(Math.random(), 6) * 4.5;   // pixels
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: glowSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0)') },
        uScale: { value: Math.min(devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size; uniform float uScale; varying vec3 vC;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mv;
          // stars sit on a fixed shell, so size in pixels reads better than attenuation
          gl_PointSize = size * uScale; }`,
      fragmentShader: `
        uniform sampler2D uTex; varying vec3 vC;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.05) discard; gl_FragColor = vec4(vC, 1.0) * t; }`,
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // faint milky-way haze so the sky isn't uniformly black
    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(48000, 24, 16),
      new THREE.MeshBasicMaterial({
        map: this._hazeTexture(), side: THREE.BackSide,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.16,
      })
    );
    this.haze = haze;
    this.scene.add(haze);
  }

  _hazeTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * 1024;
      const y = 256 + Math.sin(x / 1024 * Math.PI * 2) * 52 + (Math.random() - 0.5) * 120;
      const r = 3 + Math.random() * 18;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const h = Math.random() < 0.5 ? '120,150,255' : '180,140,220';
      grd.addColorStop(0, `rgba(${h},0.13)`); grd.addColorStop(1, `rgba(${h},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------------------------------------------------------------- sun
  _buildSun() {
    const d = this.quality.sunDetail;
    const mat = new THREE.MeshBasicMaterial({ map: sunTexture() });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(SUN.radius, d, d / 2), mat);
    this.scene.add(this.sun);

    // layered additive coronae
    this.corona = [];
    [[1.22, 0.55, 'rgba(255,214,140,1)'], [1.75, 0.26, 'rgba(255,150,60,1)'], [2.9, 0.055, 'rgba(255,110,40,1)']]
      .forEach(([s, o, col]) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowSprite(col, 'rgba(255,60,0,0)'), blending: THREE.AdditiveBlending,
          depthWrite: false, transparent: true, opacity: o,
        }));
        sp.scale.setScalar(SUN.radius * 2 * s);
        sp.renderOrder = -1;
        this.sun.add(sp);
        this.corona.push(sp);
      });

    this.bodies.push({ name: 'SUN', mesh: this.sun, radius: SUN.radius, isSun: true, group: this.sun });
  }

  // ---------------------------------------------------------------- planets
  _buildPlanets() {
    this.planets = PLANETS.map((p, i) => {
      const group = new THREE.Group();          // orbit pivot at the sun
      const holder = new THREE.Group();          // planet + moons, sits on the orbit
      holder.position.x = p.orbit;
      group.add(holder);
      group.rotation.y = i * 1.7;                // stagger starting angles
      this.scene.add(group);

      const seg = p.radius > 60 ? 48 : 32;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius, seg, seg / 2),
        new THREE.MeshStandardMaterial({
          map: planetTexture(p), roughness: 0.92, metalness: 0.0,
        })
      );
      mesh.rotation.z = p.tilt || 0.08;
      holder.add(mesh);

      if (p.atmo) {
        const atmo = new THREE.Mesh(
          new THREE.SphereGeometry(p.radius * 1.045, seg, seg / 2),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(p.atmo), transparent: true, opacity: 0.17,
            side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
          })
        );
        holder.add(atmo);
      }

      if (p.rings) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(p.radius * p.rings.inner, p.radius * p.rings.outer, 96, 1),
          new THREE.MeshBasicMaterial({
            map: ringTexture(p.rings.color), side: THREE.DoubleSide,
            transparent: true, depthWrite: false, opacity: 0.9,
          })
        );
        // map the ring texture radially
        const g = ring.geometry, uv = g.attributes.uv, pos = g.attributes.position;
        const inner = p.radius * p.rings.inner, outer = p.radius * p.rings.outer;
        for (let k = 0; k < uv.count; k++) {
          const d = Math.hypot(pos.getX(k), pos.getY(k));
          uv.setXY(k, (d - inner) / (outer - inner), 0.5);
        }
        uv.needsUpdate = true;
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = 0;
        mesh.add(ring);
      }

      let moon = null;
      if (p.moon) {
        const pivot = new THREE.Group();
        holder.add(pivot);
        moon = new THREE.Mesh(
          new THREE.SphereGeometry(p.moon.radius, 20, 12),
          new THREE.MeshStandardMaterial({ color: p.moon.color, roughness: 1 })
        );
        moon.position.x = p.moon.orbit;
        pivot.add(moon);
        this.bodies.push({ name: p.name + ' MOON', mesh: moon, radius: p.moon.radius, group: pivot });
        moon.userData.pivot = pivot;
      }

      // faint orbit line, helps you read the system at a distance
      const pts = [];
      for (let a = 0; a <= 128; a++) {
        const t = a / 128 * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * p.orbit, 0, Math.sin(t) * p.orbit));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x3a6a9a, transparent: true, opacity: 0.10 })
      );
      this.scene.add(line);

      const body = { name: p.name, mesh, radius: p.radius, group, holder, def: p, moon, visited: false };
      this.bodies.push(body);
      return body;
    });
  }

  // ---------------------------------------------------------------- asteroids
  _rockGeometry(seed) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const pos = g.attributes.position;
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < pos.count; i++) {
      V.fromBufferAttribute(pos, i).multiplyScalar(0.72 + rnd() * 0.62);
      pos.setXYZ(i, V.x, V.y, V.z);
    }
    g.computeVertexNormals();
    return g;
  }

  _makeInstanced(count, geo, color) {
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0.05, flatShading: true }),
      count
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  _buildBelt() {
    const count = BELT.count[this.quality.name] ?? 800;
    this.beltMesh = this._makeInstanced(count, this._rockGeometry(97), 0x8b8378);
    this.belt = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = BELT.inner + Math.random() * (BELT.outer - BELT.inner);
      const rock = {
        angle: a, radius: r,
        y: (Math.random() - 0.5) * BELT.thickness,
        scale: 6 + Math.pow(Math.random(), 2) * 34,
        speed: 0.02 + Math.random() * 0.012,
        spin: new THREE.Vector3(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        pos: new THREE.Vector3(), alive: true, idx: i,
      };
      this.belt.push(rock);
      this.asteroids.push(rock);
    }
  }

  /** Rocks that follow the player around so open space still feels hazardous. */
  _buildLocalRocks() {
    const count = FIELD.count[this.quality.name] ?? 100;
    this.fieldMesh = this._makeInstanced(count, this._rockGeometry(3131), 0x6f6a64);
    this.field = [];
    for (let i = 0; i < count; i++) {
      const rock = {
        pos: new THREE.Vector3(), scale: 5 + Math.pow(Math.random(), 2) * 26,
        spin: new THREE.Vector3(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        vel: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12),
        alive: true, local: true, idx: i,
      };
      this.field.push(rock);
      this.asteroids.push(rock);
    }
    this.fieldSeeded = false;
  }

  _scatterLocal(rock, around, initial) {
    const r = initial
      ? FIELD.minDist + Math.random() * (FIELD.radius - FIELD.minDist)
      : FIELD.radius * (0.75 + Math.random() * 0.25);
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    rock.pos.set(Math.cos(th) * s, u * 0.6, Math.sin(th) * s).multiplyScalar(r).add(around);
    rock.alive = true;
    rock.scale = 5 + Math.pow(Math.random(), 2) * 26;
  }

  respawnRock(rock, around) {
    if (rock.local) this._scatterLocal(rock, around, false);
    else { rock.alive = true; rock.scale = 6 + Math.pow(Math.random(), 2) * 34; }
  }

  // ---------------------------------------------------------------- update
  update(dt, playerPos) {
    this.time += dt;

    // sun churn
    this.sun.rotation.y += dt * 0.02;
    this.sun.material.map.offset.x += dt * 0.004;
    const pulse = 1 + Math.sin(this.time * 0.9) * 0.02 + Math.sin(this.time * 2.3) * 0.01;
    this.corona.forEach((sp, i) => sp.scale.setScalar(SUN.radius * 2 * [1.22, 1.75, 2.9][i] * pulse));

    // orbits + spin
    for (const b of this.planets) {
      b.group.rotation.y += b.def.speed * dt;
      b.mesh.rotation.y += dt * (0.25 - b.def.orbit / 40000);
      if (b.moon) b.moon.userData.pivot.rotation.y += b.def.moon.speed * dt;
    }

    // keep the sky centred on the player so it reads as infinitely far away
    this.stars.position.copy(playerPos);
    this.haze.position.copy(playerPos);

    this._updateBelt(dt, playerPos);
    this._updateField(dt, playerPos);
  }

  _updateBelt(dt, playerPos) {
    const mesh = this.beltMesh;
    for (let i = 0; i < this.belt.length; i++) {
      const r = this.belt[i];
      r.angle += r.speed * dt;
      r.rot.x += r.spin.x * dt; r.rot.y += r.spin.y * dt;
      r.pos.set(Math.cos(r.angle) * r.radius, r.y, Math.sin(r.angle) * r.radius);
      const s = r.alive ? r.scale : 0;
      Q.setFromEuler(r.rot);
      S.setScalar(s);
      M.compose(r.pos, Q, S);
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  _updateField(dt, playerPos) {
    const mesh = this.fieldMesh;
    if (!this.fieldSeeded) {
      this.field.forEach(r => this._scatterLocal(r, playerPos, true));
      this.fieldSeeded = true;
    }
    const cull = FIELD.radius * 1.35;
    for (let i = 0; i < this.field.length; i++) {
      const r = this.field[i];
      r.pos.addScaledVector(r.vel, dt);
      r.rot.x += r.spin.x * dt; r.rot.z += r.spin.z * dt;
      if (r.alive && r.pos.distanceToSquared(playerPos) > cull * cull) this._scatterLocal(r, playerPos, false);
      Q.setFromEuler(r.rot);
      S.setScalar(r.alive ? r.scale : 0);
      M.compose(r.pos, Q, S);
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** World-space position of a body (planets sit on rotating pivots). */
  bodyPosition(body, out = new THREE.Vector3()) {
    return body.mesh.getWorldPosition(out);
  }

  reset() {
    this.asteroids.forEach(r => { r.alive = true; });
    this.planets.forEach(p => { p.visited = false; });
    this.fieldSeeded = false;
  }
}
