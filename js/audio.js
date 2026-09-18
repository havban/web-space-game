// ===== Tiny synthesised soundtrack: engine hum, cannons, impacts =====
// Everything is generated with WebAudio — no asset downloads.

export class Audio {
  constructor() { this.ctx = null; this.enabled = true; }

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // engine: two detuned saws through a lowpass, modulated by speed
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineFilter.Q.value = 6;
    this.engineGain.connect(this.engineFilter).connect(this.master);

    this.oscs = [0, 7].map(det => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      o.detune.value = det;
      o.connect(this.engineGain);
      o.start();
      return o;
    });

    // rumble bed
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(2);
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 90; nf.Q.value = 0.8;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    noise.connect(nf).connect(this.noiseGain).connect(this.master);
    noise.start();
  }

  _noiseBuffer(sec) {
    const n = this.ctx.sampleRate * sec;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }

  engine(speedRatio, boosting) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + speedRatio * 110 + (boosting ? 60 : 0);
    this.oscs.forEach((o, i) => o.frequency.setTargetAtTime(f * (i ? 1.008 : 1), t, 0.12));
    this.engineFilter.frequency.setTargetAtTime(260 + speedRatio * 900 + (boosting ? 700 : 0), t, 0.15);
    this.engineGain.gain.setTargetAtTime(0.07 + speedRatio * 0.07, t, 0.2);
    this.noiseGain.gain.setTargetAtTime(0.02 + speedRatio * 0.05 + (boosting ? 0.06 : 0), t, 0.2);
  }

  silenceEngine() {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  laser() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.12);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }

  boom(size = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900 * size, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3 * size, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.5);
  }

  alarm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 0.18].forEach(d => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(320, t + d);
      o.frequency.linearRampToValueAtTime(180, t + d + 0.14);
      g.gain.setValueAtTime(0.12, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.16);
      o.connect(g).connect(this.master);
      o.start(t + d); o.stop(t + d + 0.18);
    });
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 880, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.1, t + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.35);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.4);
    });
  }
}
