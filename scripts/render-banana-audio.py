"""Render the original Meatgrinder soundtrack. Requires numpy and ffmpeg.

Two phase-aligned, 32-bar stems: industrial survival groove and combat surge.
All instruments are synthesized here; no samples or third-party recordings.
"""
from pathlib import Path
import argparse
import functools
import json
import subprocess
import tempfile
import wave
import numpy as np

SR, BPM, BARS = 44100, 144, 32
BEAT = 60 / BPM
LENGTH = round(BARS * 4 * BEAT * SR)
random = np.random.default_rng(20260914)

def midi(n):
    return 440 * 2 ** ((n - 69) / 12)

def filter_signal(data, low=0, high=9000):
    f = np.fft.rfftfreq(len(data), 1 / SR)
    curve = 1 / (1 + (f / high) ** 6)
    if low:
        curve *= 1 - 1 / (1 + (f / low) ** 4)
    return np.fft.irfft(np.fft.rfft(data) * curve, n=len(data))

@functools.lru_cache(maxsize=512)
def guitar(note, duration, muted=True, side=0):
    t = np.arange(round(duration * SR)) / SR
    voice = np.zeros_like(t)
    # Detuned, independently phased power-chord strings through a soft amp.
    for interval, gain in [(0, 1), (7, .65), (12, .48)]:
        f = midi(note + interval) * (1 + side * .0016)
        phase = (t * f + side * .009) % 1
        string = 2 * phase - 1 + .21 * np.sin(2 * np.pi * f * 2.001 * t)
        env = np.minimum(t / .004, 1) * np.exp(-t * (21 if muted else 3.3))
        voice += string * env * gain
    voice = np.tanh(voice * 3.6)
    voice = filter_signal(voice, 65, 3700 if muted else 4900)
    # Cabinet emphasis, pick attack, and a damped tail.
    voice += .16 * np.sin(2 * np.pi * midi(note) * t) * np.exp(-t * 18)
    voice *= np.minimum((duration - t) / .022, 1)
    return voice.astype(np.float32) * .33

@functools.lru_cache(maxsize=256)
def bass(note, duration):
    t = np.arange(round(duration * SR)) / SR
    f = midi(note - 12)
    phase = 2 * np.pi * f * t
    core = np.sin(phase) + .32 * np.sin(phase * 2) + .13 * np.sin(phase * 3)
    body = np.tanh(core * 1.9) * np.minimum(t / .004, 1)
    body *= np.exp(-t * 4) * np.minimum((duration - t) / .025, 1)
    return filter_signal(body, 24, 1000).astype(np.float32) * .58

@functools.lru_cache(maxsize=256)
def lead(note, duration):
    t = np.arange(round(duration * SR)) / SR
    phase = 2 * np.pi * midi(note) * t + .027 * np.sin(t * 2 * np.pi * 5.4)
    body = np.sin(phase + 1.7 * np.sin(phase * 2)) + .15 * np.sin(phase * 1.004)
    body = filter_signal(np.tanh(body * 2), 250, 4600)
    body *= np.minimum(t / .018, 1) * np.minimum((duration - t) / .09, 1) * np.exp(-t * 1.9)
    return body.astype(np.float32) * .21

def drum(kind):
    durations = {'kick': .45, 'snare': .26, 'hat': .08, 'open': .28, 'tom': .34, 'crash': 1.5, 'metal': .42}
    t = np.arange(round(durations[kind] * SR)) / SR
    n = random.normal(0, .45, len(t))
    if kind == 'kick':
        phase = 2 * np.pi * (44 * t + 100 * .018 * (1 - np.exp(-t / .018)))
        v = np.sin(phase) * np.exp(-t * 12) + filter_signal(n, 2600, 7000) * np.exp(-t * 150) * .5
        return (np.tanh(v * 2.2) * .74).astype(np.float32)
    if kind == 'snare':
        v = (np.sin(2 * np.pi * 185 * t) + .38 * np.sin(2 * np.pi * 310 * t)) * np.exp(-t * 28)
        v += filter_signal(n, 1400, 10500) * np.exp(-t * 21) * 3.3
        return (np.tanh(v * 1.3) * .49).astype(np.float32)
    if kind in ('hat', 'open', 'crash'):
        metallic = sum(np.sin(2 * np.pi * f * t) for f in [3673, 4927, 6209, 7949, 9311]) * .06
        decay = {'hat': 65, 'open': 16, 'crash': 3.6}[kind]
        return ((filter_signal(n, 5500, 14500) + metallic) * np.exp(-t * decay) * (.5 if kind == 'crash' else .29)).astype(np.float32)
    if kind == 'tom':
        phase = 2 * np.pi * (72 * t + 60 * .035 * (1 - np.exp(-t / .035)))
        return (np.sin(phase) * np.exp(-t * 13) * .47).astype(np.float32)
    v = sum(np.sin(2 * np.pi * f * t) for f in [391, 827, 1571, 2349]) / 4
    return (v * np.exp(-t * 18) * .23).astype(np.float32)

def place(track, mono, when, gain=1, pan=0):
    begin = round(when * SR)
    left, right = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    for offset in range(0, len(mono), LENGTH):
        chunk = mono[offset:offset + LENGTH]
        at = (begin + offset) % LENGTH
        size = min(len(chunk), LENGTH - at)
        track[at:at + size, 0] += chunk[:size] * gain * left
        track[at:at + size, 1] += chunk[:size] * gain * right
        if size < len(chunk):
            track[:len(chunk) - size, 0] += chunk[size:] * gain * left
            track[:len(chunk) - size, 1] += chunk[size:] * gain * right

def compose():
    base = np.zeros((LENGTH, 2), np.float32)
    surge = np.zeros_like(base)
    drums = {k: drum(k) for k in ['kick', 'snare', 'hat', 'open', 'tom', 'crash', 'metal']}
    riffs = [[0,0,12,0,3,0,1,0], [0,0,7,0,10,0,7,3], [0,0,-2,0,5,0,3,1], [0,0,3,0,7,6,3,1]]
    hooks = [[12,15,14,12,7,10,7,3], [12,10,7,3,5,7,6,3], [12,19,17,15,14,12,10,7], [15,14,12,10,7,6,3,1]]
    for bar in range(BARS):
        start = bar * 4 * BEAT
        root = [38,38,34,36][(bar // 2) % 4]
        breakdown = 16 <= bar < 20
        full = 8 <= bar < 16 or bar >= 24
        # Aggressive bass groove is audible from the opening beat.
        for step in [0,3,6,8,10,14]:
            note = root + (7 if step == 14 else 0)
            place(base, bass(note, BEAT * .7), start + step * BEAT / 4, .73)
        riff = riffs[bar % 4]
        for i, interval in enumerate(riff):
            if breakdown and i not in [0,3,6]:
                continue
            when = start + i * BEAT / 2
            muted = i not in [2,6] or bar % 2 == 0
            duration = BEAT * (.45 if muted else .95)
            for side in [-1,1]:
                place(base, guitar(root + interval, duration, muted, side), when + (side + 1) * .003, .57 if full else .38, side * .73)
                place(surge, guitar(root + interval, duration, muted, -side), when + .008, .55, side * .86)
            if i in [1,4,7]:
                place(surge, guitar(root, BEAT * .2, True), when + BEAT * .25, .5, -.2)
        kicks = [0,6,8,11,14] if not breakdown else [0,10]
        for i in kicks:
            place(base, drums['kick'], start + i * BEAT / 4, .92)
        for i in [4,12]:
            place(base, drums['snare'], start + i * BEAT / 4, .9 if not breakdown else .45, -.06)
        if bar % 2:
            place(base, drums['snare'], start + 15 * BEAT / 4, .22, .12)
        for i in range(16):
            if i % 2 == 0 or full:
                place(base, drums['open' if i == 10 else 'hat'], start + i * BEAT / 4 + (i % 2) * .008, .65 if i % 2 else .9, -.28 + (i % 3) * .28)
            if i in [2,7,10,15]:
                place(surge, drums['kick'], start + i * BEAT / 4, .63)
        for i in [3,7,15]:
            place(base, drums['metal'], start + i * BEAT / 4, .62 if not breakdown else 1, .45)
        if bar % 4 == 3:
            for i in range(4):
                place(base, drums['tom'], start + (3 + i / 4) * BEAT, .52, -.65 + i * .4)
                place(surge, drums['snare'], start + (3 + i / 4) * BEAT, .53, .2)
        if bar % 8 == 0:
            place(base, drums['crash'], start, .7, .3)
            place(surge, drums['crash'], start, .68, -.5)
        # Threatening interval bed, with slow stereo motion instead of plucky bells.
        t = np.arange(round(4 * BEAT * SR)) / SR
        pad = sum(np.sin(2 * np.pi * midi(root + n) * t + .14 * np.sin(t * 3)) for n in [12,19,25]) / 3
        pad *= np.sin(np.pi * np.arange(len(t)) / len(t)) ** .4
        place(base, pad.astype(np.float32), start, .11 if not breakdown else .26, -.25)
        place(base, pad.astype(np.float32), start + .025, .08, .55)
        if (full and bar % 2 == 0) or bar >= 28:
            for i, note in enumerate(hooks[(bar // 2) % 4]):
                when = start + i * BEAT / 2
                phrase = lead(root + 12 + note, BEAT * .7)
                place(base, phrase, when, .5, -.2)
                place(base, phrase, when + BEAT * .75, .15, .65)
        # A sharper counterline comes forward only in champion/frenzy combat.
        for i in range(8):
            phrase = lead(root + 24 + [0,1,7,10,12,10,7,3][i], BEAT * .34)
            place(surge, phrase, start + i * BEAT / 2, .3, .32)
    # Short rising noise builds and reversed cymbal swells announce phrase drops.
    for bar in [7,15,23,31]:
        t = np.arange(round(2 * BEAT * SR)) / SR
        swell = filter_signal(random.normal(0,.3,len(t)),1600,8000) * (t/t[-1])**2
        place(base,swell.astype(np.float32),(bar*4+2)*BEAT,.36,.1)
    return base, surge

def encode(track, output, loudness, bitrate):
    peak = float(np.max(np.abs(track)))
    track = np.tanh(track * .75) / max(1, np.tanh(peak * .75)) * .88
    # Microfade prevents a discontinuity at loop boundaries without a rhythmic gap.
    fade = round(.007 * SR)
    track[:fade] *= np.linspace(0,1,fade)[:,None]
    track[-fade:] *= np.linspace(1,0,fade)[:,None]
    with tempfile.TemporaryDirectory(prefix='banana-audio-') as temporary:
        wav = Path(temporary)/'render.wav'
        with wave.open(str(wav),'wb') as file:
            file.setparams((2,2,SR,0,'NONE','not compressed'))
            file.writeframes((np.clip(track,-1,1)*32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-af',f'highpass=f=28,alimiter=limit=0.91:level=false,loudnorm=I={loudness}:TP=-2.5:LRA=8','-ar',str(SR),'-codec:a','libmp3lame','-b:a',bitrate,str(output)],check=True)
    return {'file':output.name,'bytes':output.stat().st_size,'seconds':LENGTH/SR,'source_peak':round(peak,3)}

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'games/BananaSurvivors/gpt6_astra')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    base,surge=compose()
    print(json.dumps([encode(base,args.output/'meatgrinder.mp3',-17,'128k'),encode(surge,args.output/'meatgrinder-surge.mp3',-21,'96k')],indent=2))
