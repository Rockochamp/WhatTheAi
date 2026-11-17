const MELODY = [55,55,82.41,55,65.41,55,98,73.42,49,49,73.42,49,65.41,49,87.31,73.42];
const EFFECTS = {
  smash: [160,52,.17,'sawtooth'], hit: [93,47,.2,'triangle'], oil: [170,75,.19,'sine'],
  pit: [243,81,.45,'triangle'], special: [190,740,.46,'triangle'], fire: [540,235,.12,'triangle'],
  boost: [76,375,.3,'sawtooth'], pass: [180,320,.16,'triangle'], jump: [170,590,.19,'sine'],
  pickup: [400,720,.15,'sine'], lap: [392,660,.3,'triangle'], finish: [440,880,.6,'triangle'],
  ready: [270,270,.12,'square'], go: [475,725,.25,'triangle'],
};

export class RaceSound {
  constructor(enabled) { this.enabled = enabled; this.beat = -1; }
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.ctx = new Audio();
      this.output = this.ctx.createGain();
      this.output.gain.value = .38;
      this.output.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  set(enabled) {
    this.enabled = enabled;
    if (enabled) this.unlock();
    if (this.output) this.output.gain.setTargetAtTime(enabled ? .38 : .0001, this.ctx.currentTime, .035);
    if (!enabled) this.stop();
  }
  tone(from, to, length, type = 'sine', volume = .13, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from,t);
    osc.frequency.exponentialRampToValueAtTime(to,t+length);
    gain.gain.setValueAtTime(.001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+.012);
    gain.gain.exponentialRampToValueAtTime(.001,t+length);
    osc.connect(gain).connect(this.output);
    osc.start(t); osc.stop(t+length+.015);
  }
  fx(name) {
    if (EFFECTS[name]) this.tone(...EFFECTS[name]);
    if (name === 'finish') {
      this.tone(523,523,.31,'triangle',.1,.15);
      this.tone(659,784,.43,'triangle',.1,.29);
    }
  }
  update(r) {
    if (!this.enabled || !this.ctx) return;
    if (!this.engine) {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth'; gain.gain.value = .0001; filter.frequency.value = 190;
      osc.connect(filter).connect(gain).connect(this.output);
      osc.start();
      this.engine = { osc,gain,filter };
    }
    const t = this.ctx.currentTime;
    this.engine.osc.frequency.setTargetAtTime(34+r.speed*.29,t,.09);
    this.engine.filter.frequency.setTargetAtTime(r.nitroFiring ? 310 : 180,t,.1);
    this.engine.gain.gain.setTargetAtTime(r.nitroFiring ? .073 : .037,t,.08);
    const beat = Math.floor(r.tick / 14);
    if (beat === this.beat) return;
    this.beat = beat;
    const note = MELODY[beat % MELODY.length];
    this.tone(note,note,.14,'triangle',.055);
    if (beat % 2 === 0) this.tone(102,47,.10,'sine',.078);
    if (beat % 4 === 2) this.tone(440,175,.08,'triangle',.034);
    if (beat % 8 === 4) this.tone(note*4,note*3,.26,'sine',.026);
  }
  stop() {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.gain.gain.setTargetAtTime(.0001,t,.02);
    this.engine.osc.stop(t+.12);
    this.engine = null;
    this.beat = -1;
  }
}
