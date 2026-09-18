// ===== Unified input: keyboard, on-screen stick/buttons, gamepad-ish feel =====

const KEYMAP = {
  ArrowUp:'pitchUp', KeyW:'pitchUp',
  ArrowDown:'pitchDown', KeyS:'pitchDown',
  ArrowLeft:'yawLeft', KeyA:'yawLeft',
  ArrowRight:'yawRight', KeyD:'yawRight',
  KeyQ:'rollLeft', KeyE:'rollRight',
  ShiftLeft:'boost', ShiftRight:'boost',
  ControlLeft:'brake', ControlRight:'brake', KeyX:'brake',
  Space:'fire',
};

export class Input {
  constructor(opts = {}) {
    this.on = Object.create(null);      // action -> bool
    this.axes = { pitch: 0, yaw: 0, roll: 0 };
    this.stick = { x: 0, y: 0 };        // -1..1 from the touch stick
    this.throttle = 0.55;
    this.onAction = opts.onAction || (() => {});
    this.hasTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this._bindKeys();
    this._bindTouch();
  }

  // ---------------------------------------------------------------- keyboard
  _bindKeys() {
    const set = (e, down) => {
      const act = KEYMAP[e.code];
      if (act) { this.on[act] = down; e.preventDefault(); }
      if (!down) return;
      if (e.code === 'KeyT') this.onAction('target');
      if (e.code === 'KeyC') this.onAction('camera');
      if (e.code === 'KeyP' || e.code === 'Escape') this.onAction('pause');
      if (e.code === 'KeyR') this.onAction('restart');
      if (e.code === 'Equal' || e.code === 'NumpadAdd') this.throttle = Math.min(1, this.throttle + 0.15);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.throttle = Math.max(0, this.throttle - 0.15);
    };
    addEventListener('keydown', e => { if (!e.repeat) set(e, true); else if (KEYMAP[e.code]) e.preventDefault(); });
    addEventListener('keyup', e => set(e, false));
    addEventListener('blur', () => { this.on = Object.create(null); });
  }

  // ---------------------------------------------------------------- touch
  _bindTouch() {
    const base = document.getElementById('stick');
    if (!base) return;
    const knob = base.querySelector('.stick-knob');
    let id = null, cx = 0, cy = 0, max = 1;

    const start = e => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      id = t.identifier ?? 'mouse';
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; max = r.width * 0.42;
      move(e);
      e.preventDefault();
    };
    const move = e => {
      if (id === null) return;
      const list = e.changedTouches ? [...e.changedTouches] : [e];
      const t = list.find(p => (p.identifier ?? 'mouse') === id);
      if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(d, max);
      dx = dx / d * clamped; dy = dy / d * clamped;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / max;
      this.stick.y = dy / max;
      e.preventDefault();
    };
    const end = e => {
      const list = e.changedTouches ? [...e.changedTouches] : [e];
      if (!list.some(p => (p.identifier ?? 'mouse') === id)) return;
      id = null; this.stick.x = this.stick.y = 0;
      knob.style.transform = 'translate(0,0)';
    };

    base.addEventListener('touchstart', start, { passive: false });
    base.addEventListener('touchmove', move, { passive: false });
    base.addEventListener('touchend', end);
    base.addEventListener('touchcancel', end);
    base.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') start(e); });
    addEventListener('pointermove', e => { if (e.pointerType !== 'touch') move(e); });
    addEventListener('pointerup', e => { if (e.pointerType !== 'touch') end(e); });

    // hold-style buttons
    document.querySelectorAll('#touch .btn[data-act]').forEach(btn => {
      const act = btn.dataset.act;
      const down = e => {
        e.preventDefault();
        btn.classList.add('down');
        if (act === 'target') this.onAction('target');
        else this.on[act] = true;
      };
      const up = e => { e.preventDefault(); btn.classList.remove('down'); if (act !== 'target') this.on[act] = false; };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up);
      btn.addEventListener('touchcancel', up);
      btn.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') down(e); });
      btn.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') up(e); });
      btn.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') up(e); });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  /** Blend keyboard and stick into smooth axes. Call once per frame. */
  sample(dt) {
    const k = 1 - Math.exp(-11 * dt);   // input smoothing
    const key = (a, b) => (this.on[a] ? 1 : 0) - (this.on[b] ? 1 : 0);

    const pitch = clamp(key('pitchDown', 'pitchUp') + this.stick.y, -1, 1);
    const yaw = clamp(key('yawRight', 'yawLeft') + this.stick.x, -1, 1);
    const roll = clamp(key('rollLeft', 'rollRight'), -1, 1);

    this.axes.pitch += (pitch - this.axes.pitch) * k;
    this.axes.yaw += (yaw - this.axes.yaw) * k;
    this.axes.roll += (roll - this.axes.roll) * k;

    return {
      // screen-down on the stick pulls the nose up, like a real stick
      pitch: -this.axes.pitch,
      yaw: -this.axes.yaw,
      roll: this.axes.roll,
      boost: !!this.on.boost,
      brake: !!this.on.brake,
      fire: !!this.on.fire,
      throttle: this.on.boost ? 1 : this.throttle,
    };
  }

  releaseAll() { this.on = Object.create(null); this.stick.x = this.stick.y = 0; }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
