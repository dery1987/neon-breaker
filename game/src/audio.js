// Synthesised sound effects with plain WebAudio — no audio files, no network.
// Every effect is a short oscillator blip with an envelope; a tiny sequencer
// plays the level-clear and victory jingles. Audio starts only after the first
// user gesture, as browsers require.

const NOTE = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
};

export class SoundFX {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    /** True once the context exists (after the first gesture). */
    this.ready = false;
  }

  /** Create the AudioContext; call from a user gesture. Safe to call twice. */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.context.destination);
    this.ready = true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
    return this.muted;
  }

  /** One oscillator note with a fast attack and an exponential decay. */
  tone(frequency, duration, type = 'square', volume = 1, when = 0, slideTo = null) {
    if (!this.ready || this.muted) return;
    const now = this.context.currentTime + when;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.6 * volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /** A short filtered-noise burst (impacts, explosions). */
  noise(duration, volume = 1, when = 0) {
    if (!this.ready || this.muted) return;
    const now = this.context.currentTime + when;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.5 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  click() {
    this.tone(660, 0.06, 'sine', 0.7);
  }

  launch() {
    this.tone(320, 0.16, 'sine', 0.9, 0, 640);
  }

  paddle() {
    this.tone(220, 0.07, 'triangle', 0.9, 0, 330);
  }

  wall() {
    this.tone(180, 0.05, 'triangle', 0.6);
  }

  /** Pitch climbs with the combo, so long rallies sound hotter. */
  brick(combo) {
    const base = 440 + Math.min(combo, 8) * 40;
    this.tone(base, 0.09, 'square', 0.8, 0, base * 1.6);
    this.noise(0.05, 0.35);
  }

  toughHit() {
    this.tone(160, 0.08, 'sawtooth', 0.8, 0, 110);
  }

  powerup() {
    this.tone(NOTE.C5, 0.09, 'sine', 0.9);
    this.tone(NOTE.E5, 0.09, 'sine', 0.9, 0.07);
    this.tone(NOTE.G5, 0.14, 'sine', 0.9, 0.14);
  }

  loseLife() {
    this.tone(320, 0.5, 'sawtooth', 0.9, 0, 70);
    this.noise(0.25, 0.5);
  }

  levelClear() {
    const seq = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
    seq.forEach((note, i) => this.tone(note, 0.16, 'triangle', 0.9, i * 0.11));
  }

  victory() {
    const seq = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6];
    seq.forEach((note, i) => this.tone(note, 0.2, 'triangle', 0.9, i * 0.13));
  }

  gameOver() {
    const seq = [NOTE.A4, NOTE.F4, NOTE.D4, NOTE.C4];
    seq.forEach((note, i) => this.tone(note, 0.28, 'sawtooth', 0.7, i * 0.18));
  }
}
