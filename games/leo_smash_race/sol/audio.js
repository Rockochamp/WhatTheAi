const TICK = 60 / 144 / 4;
const PITCH = note => 440 * 2 ** ((note - 69) / 12);
const NOTE = { kick: [152, 41, .21, 'sine', .54], rim: [285, 143, .084, 'triangle', .22] };
const BASS = [0,,0,12,,0,7,,0,,3,0,,7,,10];
const MELODY = [24,,,19,,22,,17,15,,,17,,19,,22];
const ROOTS = [38,38,41,36,38,38,34,36,38,38,41,36,34,36,38,36];
const CHORDS = [[0,3,7],[0,3,7],[0,4,7],[0,4,7],[0,3,7],[0,3,7],[0,4,7],[0,4,7]];

export class RaceSound {
  constructor(enabled, musicEnabled) {
    this.enabled = enabled;
    this.musicEnabled = musicEnabled;
    this.musicStep = 0;
    this.nextBeat = 0;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      try { this.ctx = new Audio(); } catch { return; }
      const ctx = this.ctx;
      this.output = ctx.createGain();
      this.output.gain.value = .65;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 14;
      limiter.ratio.value = 6;
      limiter.attack.value = .004;
      limiter.release.value = .14;
      this.output.connect(limiter).connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.gain.value = this.musicEnabled ? .55 : .0001;
      this.music.connect(this.output);
      const delay = ctx.createDelay(.5);
      delay.delayTime.value = TICK * 3;
      const feedback = ctx.createGain();
      feedback.gain.value = .24;
      delay.connect(feedback).connect(delay);
      delay.connect(this.music);
      this.lead = ctx.createGain();
      this.lead.gain.value = .53;
      this.lead.connect(this.music);
      this.lead.connect(delay);
      this.noise = ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
      const values = this.noise.getChannelData(0);
      for (let i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
      this.bassWave = ctx.createPeriodicWave(new Float32Array(7),new Float32Array([0,1,.64,.36,.25,.11,.09]));
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  set(enabled) {
    this.enabled = enabled;
    if (enabled) this.unlock();
    if (this.output) this.output.gain.setTargetAtTime(enabled ? .65 : .0001,this.ctx.currentTime,.028);
    if (!enabled) this.stop();
  }

  setMusic(enabled) {
    this.musicEnabled = enabled;
    this.nextBeat = 0;
    if (this.music) this.music.gain.setTargetAtTime(enabled ? .55 : .0001,this.ctx.currentTime,.045);
  }

  oscillator(bus, time, from, to, length, shape, volume, attack = .006) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator(), env = ctx.createGain();
    if (shape === 'bass') osc.setPeriodicWave(this.bassWave);
    else osc.type = shape;
    osc.frequency.setValueAtTime(from,time);
    osc.frequency.exponentialRampToValueAtTime(to,time+length*.82);
    env.gain.setValueAtTime(.0001,time);
    env.gain.exponentialRampToValueAtTime(volume,time+attack);
    env.gain.exponentialRampToValueAtTime(.0001,time+length);
    osc.connect(env).connect(bus);
    osc.start(time);
    osc.stop(time+length+.01);
  }

  burst(bus,time,filterType,from,to,length,volume,q = .8) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), env = ctx.createGain();
    source.buffer = this.noise;
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from,time);
    filter.frequency.exponentialRampToValueAtTime(to,time+length);
    env.gain.setValueAtTime(.001,time);
    env.gain.exponentialRampToValueAtTime(volume,time+.005);
    env.gain.exponentialRampToValueAtTime(.0001,time+length);
    source.connect(filter).connect(env).connect(bus);
    source.start(time,Math.random()*.34,length+.012);
  }

  fx(name, event = {}) {
    if (!this.enabled || this.ctx?.state !== 'running') return;
    const time = this.ctx.currentTime;
    const tone = (from,to,length,shape,volume,delay = 0) => this.oscillator(this.output,time+delay,from,to,length,shape,volume);
    const dust = (type,from,to,length,volume,delay = 0) => this.burst(this.output,time+delay,type,from,to,length,volume);

    switch (name) {
      case 'touch':
        tone(460,255,.043,'triangle',.16);
        dust('highpass',1700,2900,.028,.12);
        break;
      case 'smash': {
        const weight = event.object?.kind === 'barrier' ? 1.3 : 1;
        tone(155,42,.21,'sine',.44*weight);
        dust('bandpass',1850,480,.19,.59*weight);
        dust('highpass',6200,2400,.16,.22,.04);
        if (event.combo > 1) tone(PITCH(60+event.combo*2),PITCH(60+event.combo*2),.16,'triangle',.11,.045);
        break;
      }
      case 'punch':
        tone(174+event.index*18,34,.27,'sine',.59);
        dust('lowpass',1730,135,.35,.62);
        dust('bandpass',245,98,.36,.41,.023);
        tone(389,125,.19,'triangle',.24,.015);
        break;
      case 'hit':
        tone(108,40,.23,'sine',.36);
        dust('bandpass',680,240,.23,.72);
        dust('highpass',2800,1700,.10,.25,.034);
        break;
      case 'boost':
        dust('bandpass',230,2250,.41,.43);
        tone(112,530,.30,'triangle',.31);
        tone(64,126,.25,'bass',.18);
        break;
      case 'special':
        tone(162,614,.37,'bass',.27);
        tone(246,983,.29,'triangle',.19,.04);
        dust('bandpass',500,3000,.26,.26);
        break;
      case 'pickup': {
        const pitch = ({repair:440,shield:329.6,ring:659.3,cell:554.4,pad:493.9,ramp:392})[event.object?.kind] ?? 520;
        tone(pitch,pitch,.13,'triangle',.20);
        tone(pitch*1.5,pitch*2,.18,'sine',.24,.061);
        break;
      }
      case 'fire': dust('bandpass',3300,350,.14,.38); tone(730,120,.13,'triangle',.23); break;
      case 'oil': dust('bandpass',500,2050,.28,.32); break;
      case 'jump': dust('bandpass',570,2200,.19,.21); tone(190,420,.13,'triangle',.17); break;
      case 'pass': dust('bandpass',2200,590,.17,.28); break;
      case 'pit': tone(242,79,.38,'triangle',.24); tone(523,523,.14,'sine',.2,.42); break;
      case 'lap': tone(523,523,.18,'triangle',.22); tone(784,784,.22,'triangle',.19,.13); break;
      case 'ready': tone(330,330,.15,'square',.14); break;
      case 'go': tone(660,787,.31,'triangle',.24); dust('highpass',500,2500,.22,.26); break;
      case 'finish':
        [554.4,659.3,830.6,1108.7].forEach((note,i) => tone(note,note,.38,'triangle',.22-i*.02,i*.095));
        break;
    }
  }

  scheduleNote(time, n, intense) {
    const s = n % 16, bar = Math.floor(n / 16) % ROOTS.length;
    const root = ROOTS[bar], bus = this.music;
    const drum = (kind,volume = 1) => {
      const [from,to,len,type,amp] = NOTE[kind];
      this.oscillator(bus,time,from,to,len,type,amp*volume);
    };
    if (s === 0 || s === 7 || s === 10 || (intense && s === 14)) drum('kick',s === 14 ? .62 : 1);
    if (s === 4 || s === 12) {
      drum('rim');
      this.burst(bus,time,'bandpass',1850,1040,.17,.49);
      this.burst(bus,time+.014,'highpass',3500,2100,.11,.24);
    }
    if (s % 2 === 0 || intense) {
      const open = s === 2 || s === 10;
      this.burst(bus,time,'highpass',open ? 5400 : 8200,4200,open ? .15 : .052,open ? .23 : .115);
    }
    if (BASS[s] !== undefined) {
      const hz = PITCH(root+BASS[s]);
      this.oscillator(bus,time,hz,hz*.992,s === 0 ? .17 : .10,'bass',s%4 === 0 ? .27 : .19);
    }
    if ((bar%4 >= 2 || intense) && MELODY[s] !== undefined) {
      const hz = PITCH(root + MELODY[s]);
      this.oscillator(this.lead,time,hz,hz,.17,'triangle',.23,.017);
    }
    if (s === 0 || (s === 8 && intense)) {
      const offsets = CHORDS[bar % CHORDS.length];
      for (const offset of offsets) {
        const hz = PITCH(root + 24 + offset);
        this.oscillator(this.lead,time,hz,hz,s === 0 ? .52 : .31,'sine',.15,.029);
      }
    }
  }

  update(r) {
    if (!this.enabled || this.ctx?.state !== 'running') return;
    const ctx = this.ctx, time = ctx.currentTime;
    if (!this.engine) {
      const motor = ctx.createOscillator(), filter = ctx.createBiquadFilter(), level = ctx.createGain();
      const tires = ctx.createBufferSource(), band = ctx.createBiquadFilter(), skid = ctx.createGain();
      motor.setPeriodicWave(this.bassWave);
      filter.frequency.value = 170;
      level.gain.value = .0001;
      motor.connect(filter).connect(level).connect(this.output);
      motor.start();
      tires.buffer = this.noise;
      tires.loop = true;
      band.type = 'bandpass';
      band.frequency.value = 1140;
      band.Q.value = 3;
      skid.gain.value = .0001;
      tires.connect(band).connect(skid).connect(this.output);
      tires.start();
      this.engine = { motor, filter, level, tires, skid };
    }
    const { motor, filter, level, skid } = this.engine;
    motor.frequency.setTargetAtTime(31+r.speed*.32,time,.045);
    filter.frequency.setTargetAtTime(r.nitroFiring || r.turbo > 0 ? 515 : 222,time,.075);
    level.gain.setTargetAtTime(r.air > 0 ? .042 : r.nitroFiring ? .132 : .085,time,.072);
    skid.gain.setTargetAtTime(r.drifting || r.slick > 0 ? .22 : .0001,time,.07);
    if (!this.musicEnabled) return;
    if (this.nextBeat < time) this.nextBeat = time + .025;
    const intense = r.distance >= r.circuit.length || r.nitroFiring;
    while (this.nextBeat < time+.135) {
      this.scheduleNote(this.nextBeat,this.musicStep++,intense);
      this.nextBeat += TICK;
    }
  }

  restart() {
    this.stop();
    this.musicStep = 0;
  }

  stop() {
    this.nextBeat = 0;
    if (!this.engine) return;
    const time = this.ctx.currentTime;
    const { level, skid, motor, tires } = this.engine;
    level.gain.setTargetAtTime(.0001,time,.016);
    skid.gain.setTargetAtTime(.0001,time,.016);
    motor.stop(time+.11);
    tires.stop(time+.11);
    this.engine = null;
  }
}
