# Synthesizes every sound effect in code (no samples) from build/sfx.json,
# then mixes dialogue + SFX into the delivery stems.
import json, numpy as np, soundfile as sf
SR = 48000; DUR = 120
rng = np.random.default_rng(7)
def t_(d): return np.arange(int(d * SR)) / SR
def env_ad(n, a, d):  # attack/decay envelope in seconds
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def lp(x, a):  # one-pole lowpass, a in 0..1 (higher = brighter)
    y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s += a * (x[i] - s); y[i] = s
    return y
def lp_fast(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x))
def hp_fast(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 - 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x))
def noise(d): return rng.standard_normal(int(d * SR))
def sweep_noise(d, f0, f1):  # band-ish noise sweeping in brightness
    n = noise(d); out = np.zeros_like(n); seg = 2048
    for i in range(0, len(n), seg):
        p = i / len(n); c = f0 * (f1 / f0) ** p
        out[i:i + seg] = lp_fast(np.pad(n[i:i + seg], (0, max(0, seg - len(n[i:i + seg])))), c)[:len(n[i:i + seg])]
    return out
def hit(gain=1):
    d = 1.2; t = t_(d)
    body = np.sin(2 * np.pi * (48 * t + 70 * (1 - np.exp(-t * 18)) / 18)) * env_ad(len(t), .002, .32)
    click = hp_fast(noise(d), 2500) * env_ad(len(t), .0005, .012) * .5
    tail = lp_fast(noise(d), 900) * env_ad(len(t), .002, .18) * .35
    return (body * .9 + click + tail) * gain
def boom(gain=1):
    d = 2.6; t = t_(d)
    sub = np.sin(2 * np.pi * (38 * t + 90 * (1 - np.exp(-t * 6)) / 6)) * env_ad(len(t), .003, .9)
    air = lp_fast(noise(d), 600) * env_ad(len(t), .004, .5) * .5
    h = np.zeros(len(t)); hh = hit(.6); h[:len(hh)] = hh
    return (sub + air + h) * gain
def whoosh(gain=1, d=.7):
    n = sweep_noise(d, 400, 6000); t = t_(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return hp_fast(n, 200) * e * .8 * gain
def swipe(gain=1): return whoosh(gain, .35)
def riser(gain=1, d=1.6):
    t = t_(d); n = sweep_noise(d, 300, 9000) * (t / d) ** 2
    tone = np.sin(2 * np.pi * (220 * t + 300 * t * t / d)) * (t / d) ** 3 * .25
    out = (n * .7 + tone) * gain
    return np.concatenate([out, np.zeros(int(.05 * SR))])
def tick_one(f=3200): d = .03; t = t_(d); return np.sin(2 * np.pi * f * t) * env_ad(len(t), .0003, .004)
def ticks(gain=1, d=1.0):
    # 'count-up' swell: airy filtered noise rising in brightness + a soft tonal shimmer (A/E fifth), no clicks
    t = t_(d); e = (t / d) ** 1.6 * np.exp(-np.maximum(0, t - d * .85) / .06)
    air = hp_fast(sweep_noise(d, 700, 5200), 400) * .35
    tone = sum(np.sin(2 * np.pi * f * t * (1 + .03 * t / d)) for f in (440, 659.25, 880)) * .06
    return (air + tone) * e * .55 * gain
def pop(gain=1):
    # soft UI tap: low felt thump + muted transient (no pitch sweep)
    d = .25; t = t_(d)
    thump = np.sin(2 * np.pi * 150 * t) * env_ad(len(t), .002, .045)
    tick = lp_fast(hp_fast(noise(d), 1200), 4500) * env_ad(len(t), .0004, .006) * .35
    return (thump * .6 + tick) * .5 * gain
def glitch(gain=1):
    d = .38; n = noise(d); steps = np.resize(np.repeat(rng.standard_normal(int(d * 60) + 1), int(SR / 60)), len(n))
    crushed = np.round(n * 3) / 3 * .4 + np.sign(steps) * .25
    gate = (np.sin(2 * np.pi * 26 * t_(d)) > 0).astype(float)
    return hp_fast(crushed * gate, 300) * .6 * gain
def chime(gain=1, notes=(659.25, 523.25, 392.0)):  # airport-style PA chime
    out = np.zeros(int((1.7 + .32 * len(notes)) * SR))
    for k, f in enumerate(notes):
        t = t_(1.6); s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t)) * env_ad(len(t), .004, .55)
        i = int(k * .32 * SR); out[i:i + len(s)] += s
    return out * .35 * gain
def chime_end(gain=1): return chime(gain, (523.25, 659.25, 783.99, 1046.5))
def flip(gain=1):
    d = .08; return hp_fast(noise(d), 1500) * env_ad(int(d * SR), .0005, .01) * .5 * gain
def truck(gain=1):
    d = 1.8; t = t_(d); rumble = lp_fast(noise(d), 160) * 2.2 + np.sin(2 * np.pi * 42 * t) * .3
    e = np.minimum(1, t / .3) * np.exp(-np.maximum(0, t - 1.1) / .25)
    brake = hp_fast(noise(.25), 3000) * np.linspace(.2, 0, int(.25 * SR))
    out = rumble * e; i = int(1.45 * SR); out[i:i + len(brake)] += brake[:len(out) - i]
    return out * .6 * gain
def sub(gain=1): d = 2.5; t = t_(d); return np.sin(2 * np.pi * 34 * t) * env_ad(len(t), .2, 1.0) * gain
def clock(gain=1):
    out = np.zeros(int(2.6 * SR))
    for k in range(5):
        s = tick_one(1800 if k % 2 else 1400) * 1.4; i = int(k * .5 * SR); out[i:i + len(s)] += s
    return out * gain
def riser_short(gain=1): return riser(gain, .6)
GEN = dict(hit=hit, boom=boom, whoosh=whoosh, swipe=swipe, riser=riser, ticks=ticks, pop=pop, glitch=glitch, chime=chime,
           chime_end=chime_end, flip=flip, truck=truck, sub=sub, clock=clock, riser_short=riser_short)
PRE = dict(riser=lambda g: len(riser(g)) - int(.05 * SR), riser_short=lambda g: len(riser(g, .6)) - int(.05 * SR))  # risers END on their time
cues = json.load(open('build/sfx.json'))
mix = np.zeros(DUR * SR + SR * 3)
for c in cues:
    s = GEN[c['type']](c['gain'])
    i = int(c['t'] * SR) - (PRE[c['type']](c['gain']) if c['type'] in PRE else 0)
    if i < 0: s = s[-i:]; i = 0
    mix[i:i + len(s)] += s[:len(mix) - i]
mix = mix[:DUR * SR]
mix = np.tanh(mix * .9) * .5  # gentle saturation / safety
st = np.stack([mix, mix], 1)
sf.write('build/sfx.wav', st, SR, subtype='PCM_24')
print('sfx', len(cues))
