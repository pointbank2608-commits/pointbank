"""Original ClassBank mini-game sound design. Python standard library only.

Run from any directory: python app/scripts/sfx/build-minigame-sfx.py
Synthesizes mono PCM WAVs; no recordings, sample libraries or runtime AI.
"""
from array import array
import hashlib
import json
import math
from pathlib import Path
import random
import sys
import wave

RATE = 32000
DEST = Path(__file__).resolve().parents[2] / 'public/sounds/minigames'
DEST.mkdir(parents=True, exist_ok=True)
PI = math.pi


def sound(duration):
    return [0.0] * int(duration * RATE)


def tone(out, start, duration, frequency, end=None, volume=.25, kind='bell'):
    phase = 0.0
    for i in range(int(duration * RATE)):
        t = i / RATE
        at = int(start * RATE) + i
        if at >= len(out):
            break
        f = frequency * ((end / frequency) ** (t / duration)) if end else frequency
        phase += 2 * PI * f / RATE
        envelope = min(1, t / .006) * min(1, (duration - t) / .018)
        if kind == 'bell':
            envelope *= math.exp(-4.3 * t / duration)
            value = math.sin(phase) + .2 * math.sin(phase * 2.01) + .07 * math.sin(phase * 3.98)
        elif kind == 'wood':
            envelope *= math.exp(-8 * t / duration)
            value = math.sin(phase) + .35 * math.sin(phase * 2.7)
        else:
            value = math.sin(phase) + .1 * math.sin(phase * 2)
        out[at] += value * envelope * volume


def noise(out, start, duration, volume=.2, cutoff=900, seed=1, pulse=0):
    rng = random.Random(seed)
    low = 0.0
    alpha = 1 - math.exp(-2 * PI * cutoff / RATE)
    for i in range(int(duration * RATE)):
        t = i / RATE
        at = int(start * RATE) + i
        if at >= len(out):
            break
        low += alpha * (rng.uniform(-1, 1) - low)
        envelope = min(1, t / .008) * min(1, (duration - t) / .07)
        envelope *= .25 + .75 * math.sin(PI * t / duration)
        if pulse:
            envelope *= .35 + .65 * max(0, math.sin(t * pulse * 2 * PI))
        out[at] += low * envelope * volume


def notes(out, frequencies, step=.11, start=0, duration=.36, volume=.23):
    for i, f in enumerate(frequencies):
        tone(out, start + i * step, duration, f, volume=volume)


def design(name):
    lengths = {'intro': .8, 'pick': .13, 'place': .22, 'shuffle': .42,
               'next': .55, 'wrong': .48, 'time-up': .72, 'finish': 1.85,
               'balloon-pop': .52, 'train-depart': 1.85, 'train-arrive': .8,
               'fish-cast': .7, 'fish-catch': 1.15, 'rocket-fuel': .8,
               'rocket-countdown': .22, 'rocket-launch': 2.65,
               'detective-stamp': .65, 'hunt-step': .3, 'treasure-open': 1.5,
               'claw-move': .24, 'claw-drop': .85, 'claw-catch': 1.35,
               'monster-nibble': .9, 'bridge-hop': .8, 'tower-stack': .95}
    out = sound(lengths[name])
    if name == 'intro': notes(out, [523.25, 659.25, 880], .13, duration=.45)
    elif name == 'pick': tone(out, 0, .11, 780, 1050, .24, 'wood')
    elif name == 'place':
        tone(out, 0, .13, 350, volume=.28, kind='wood'); tone(out, .06, .14, 690, volume=.18)
    elif name == 'shuffle':
        for i in range(4): noise(out, i * .075, .1, .34, 2200, i + 10)
    elif name == 'next': notes(out, [440, 587.33, 783.99], .09, duration=.3, volume=.2)
    elif name == 'wrong':
        tone(out, 0, .23, 390, 310, .23, 'soft'); tone(out, .18, .23, 330, 280, .16, 'soft')
    elif name == 'time-up': notes(out, [698.46, 587.33, 523.25], .17, duration=.27, volume=.2)
    elif name == 'finish':
        notes(out, [523.25, 659.25, 783.99, 1046.5], .18, duration=.65)
        notes(out, [587.33, 880, 1174.66], .13, start=.95, duration=.5, volume=.16)
    elif name == 'balloon-pop':
        tone(out, 0, .09, 590, 145, .32, 'soft'); noise(out, 0, .09, .33, 3800, 21)
        notes(out, [1174.66, 1567.98], .06, start=.09, duration=.28, volume=.17)
    elif name == 'train-depart':
        for i in range(9):
            at = .08 + i * .165
            noise(out, at, .1, .28, 650, i + 30); tone(out, at, .085, 120, 80, .16, 'wood')
        tone(out, .12, .46, 740, 830, .19, 'soft'); tone(out, .12, .46, 1110, 1245, .07, 'soft')
        tone(out, .72, .38, 830, 740, .14, 'soft')
    elif name == 'train-arrive': notes(out, [659.25, 880, 659.25], .17, duration=.3, volume=.2)
    elif name == 'fish-cast':
        noise(out, 0, .32, .34, 2100, 45); tone(out, .26, .19, 740, 220, .2, 'soft')
        noise(out, .31, .25, .42, 1200, 46)
    elif name == 'fish-catch':
        for i in range(6): tone(out, i * .09, .14, 230 + i * 100, (230 + i * 100) * 1.6, .17, 'soft')
        noise(out, .06, .43, .28, 1000, 47); notes(out, [880, 1174.66], .1, start=.56, duration=.4)
    elif name == 'rocket-fuel':
        tone(out, 0, .42, 220, 880, .2, 'soft'); notes(out, [1046.5, 1318.51], .09, start=.4, duration=.28, volume=.16)
    elif name == 'rocket-countdown': tone(out, 0, .18, 740, volume=.23, kind='soft')
    elif name == 'rocket-launch':
        noise(out, 0, 2.55, .62, 390, 51); noise(out, .3, 2.15, .2, 1800, 52)
        tone(out, 0, 2.5, 65, 250, .15, 'soft'); tone(out, .15, 2.2, 130, 600, .08, 'soft')
    elif name == 'detective-stamp':
        tone(out, 0, .12, 150, 85, .35, 'wood'); noise(out, 0, .065, .38, 1400, 61)
        notes(out, [783.99, 1046.5], .1, start=.16, duration=.35)
    elif name == 'hunt-step':
        tone(out, 0, .1, 190, volume=.23, kind='wood'); tone(out, .13, .1, 240, volume=.2, kind='wood')
    elif name == 'treasure-open':
        tone(out, 0, .2, 180, 360, .15, 'soft'); noise(out, .05, .22, .18, 600, 71)
        notes(out, [659.25, 880, 1174.66, 1567.98], .14, start=.25, duration=.55, volume=.2)
        for i in range(5): tone(out, .78 + i * .09, .23, 1400 + i * 170, volume=.07)
    elif name == 'claw-move': tone(out, 0, .18, 170, 210, .16, 'soft'); noise(out, 0, .2, .15, 400, 80)
    elif name == 'claw-drop':
        tone(out, 0, .57, 430, 160, .15, 'soft'); noise(out, 0, .56, .13, 600, 81)
        tone(out, .6, .13, 280, volume=.24, kind='wood')
    elif name == 'claw-catch':
        tone(out, 0, .55, 180, 500, .15, 'soft'); notes(out, [659.25, 880, 1318.51], .12, start=.55, duration=.43, volume=.2)
    elif name == 'monster-nibble':
        for i in range(3):
            tone(out, i * .14, .13, 220 + i * 65, 160 + i * 35, .27, 'soft')
            noise(out, .03 + i * .14, .05, .15, 1000, i + 90)
        notes(out, [880, 1174.66], .1, start=.42, duration=.3, volume=.16)
    elif name == 'bridge-hop':
        tone(out, 0, .24, 250, 710, .23, 'soft'); noise(out, .25, .23, .25, 1250, 95)
        notes(out, [880, 1174.66], .09, start=.33, duration=.28, volume=.15)
    elif name == 'tower-stack':
        tone(out, 0, .22, 570, 210, .16, 'soft'); tone(out, .24, .12, 175, 100, .32, 'wood')
        notes(out, [659.25, 880, 1174.66], .1, start=.35, duration=.33, volume=.2)
    return out


NAMES = ['intro', 'pick', 'place', 'shuffle', 'next', 'wrong', 'time-up', 'finish',
         'balloon-pop', 'train-depart', 'train-arrive', 'fish-cast', 'fish-catch',
         'rocket-fuel', 'rocket-countdown', 'rocket-launch', 'detective-stamp',
         'hunt-step', 'treasure-open', 'claw-move', 'claw-drop', 'claw-catch',
         'monster-nibble', 'bridge-hop', 'tower-stack']
manifest = []
for name in NAMES:
    data = design(name)
    peak = max(abs(x) for x in data)
    gain = min(1, .67 / max(peak, .00001))
    pcm = array('h', (round(x * gain * 32767) for x in data))
    if sys.byteorder != 'little': pcm.byteswap()
    path = DEST / (name + '.wav')
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(RATE); out.writeframes(pcm.tobytes())
    rms = math.sqrt(sum((x * gain) ** 2 for x in data) / len(data))
    manifest.append({'name': name, 'seconds': round(len(data) / RATE, 3),
                     'peak_dbfs': round(20 * math.log10(max(peak * gain, .000001)), 2),
                     'rms_dbfs': round(20 * math.log10(max(rms, .000001)), 2),
                     'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(DEST / 'manifest.json').write_text(json.dumps({'sample_rate': RATE, 'channels': 1,
    'source': 'Original procedural synthesis; no third-party samples', 'sounds': manifest}, indent=2) + '\n', encoding='utf-8')
print(f'Generated {len(manifest)} original WAV effects: {sum(p.stat().st_size for p in DEST.glob("*.wav")):,} bytes')
