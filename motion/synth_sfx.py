# Synthesizes every sound effect in code (no samples) from build/sfx.json.
# Palette is deliberately restrained ("C-suite"): tuned, soft-edged sounds; big impacts only on anchor moments.
# Every instance gets seeded micro-variation (pitch, brightness, length) so repeats never sound identical.
import json, numpy as np, soundfile as sf
SR = 48000; DUR = 120
ROOT = 146.83  # D3 — everything tonal sits in D minor so it agrees with the 120 BPM bed
def semi(p): return 2 ** (p / 12)
def t_(d): return np.arange(int(d * SR)) / SR
def env_ad(n, a, d):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def filt(x, lo=None, hi=None, order=4):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    if hi: X *= 1 / (1 + (f / hi) ** order)
    if lo: X *= 1 - 1 / (1 + (f / lo) ** order)
    return np.fft.irfft(X, len(x))
def noise(rng, d): return rng.standard_normal(int(d * SR))
def sweep_noise(rng, d, f0, f1):
    n = noise(rng, d); out = np.zeros_like(n); seg = 2048
    for i in range(0, len(n), seg):
        c = f0 * (f1 / f0) ** (i / len(n)); chunk = n[i:i + seg]
        out[i:i + len(chunk)] = filt(np.pad(chunk, (0, seg - len(chunk))), hi=c)[:len(chunk)]
    return out
def verb(x, rng, size=.6, mix=.25):
    # cheap diffuse tail: noise burst convolution
    L = int(size * SR); ir = rng.standard_normal(L) * np.exp(-np.arange(L) / (SR * size / 5))
    ir = filt(ir, lo=200, hi=6000); ir /= np.abs(ir).sum() ** .5 * 6
    n = len(x) + L; wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
    out = np.zeros(len(x) + L); out[:len(x)] += x * (1 - mix); out += wet * mix
    return out

# ---------------- generators: (gain, p, rng) -> mono array ----------------
def boom(g, p, rng):  # anchor impact: sub drop + soft body + air (title, "1 winner", "zero")
    d = 2.8; t = t_(d)
    sub = np.sin(2 * np.pi * (36 * t + 80 * (1 - np.exp(-t * 6)) / 6)) * env_ad(len(t), .004, 1.0)
    body = filt(noise(rng, d), hi=420) * env_ad(len(t), .003, .35) * .7
    tone = np.sin(2 * np.pi * ROOT / 2 * t) * env_ad(len(t), .01, 1.2) * .35
    return verb(sub + body + tone, rng, 1.4, .3) * g
def card(g, p, rng):  # tuned chapter impact: felt-mallet low note + fifth, soft transient
    d = 1.6; t = t_(d); f = ROOT * semi(p) * (1 + rng.uniform(-.004, .004))
    note = (np.sin(2 * np.pi * f * t) + .45 * np.sin(2 * np.pi * f * 1.5 * t) + .2 * np.sin(2 * np.pi * f * 2 * t)) * env_ad(len(t), .006, .45)
    thump = np.sin(2 * np.pi * 55 * t) * env_ad(len(t), .002, .12) * .8
    click = filt(noise(rng, d), lo=1500, hi=5000) * env_ad(len(t), .0005, .008) * .25
    return verb((note * .55 + thump + click), rng, 1.0, .28) * g
def stab(g, p, rng):  # musical chord stab for the proof montage (rising D-minor degrees)
    d = 1.1; t = t_(d); f = ROOT * semi(p)
    chord = sum(np.sign(np.sin(2 * np.pi * f * m * t)) * w for m, w in ((1, .5), (1.189, .35), (1.498, .35), (2, .25)))
    chord = filt(chord, hi=1800 + 600 * rng.uniform(0, 1)) * env_ad(len(t), .004, .22)
    sub = np.sin(2 * np.pi * f / 2 * t) * env_ad(len(t), .003, .3) * .6
    return verb(chord * .35 + sub, rng, .9, .3) * g
def lock(g, p, rng):  # number settles: two soft mechanical clicks + quiet low confirm
    d = .5; t = t_(d); out = np.zeros(len(t))
    for k, dt in enumerate((0, .045)):
        i = int(dt * SR); c = filt(noise(rng, .03), lo=900, hi=3500) * env_ad(int(.03 * SR), .0004, .006) * (.5 if k else .35)
        out[i:i + len(c)] += c
    out += np.sin(2 * np.pi * ROOT * semi(-12 + p) * t) * env_ad(len(t), .004, .09) * .45
    return out * g
def accent(g, p, rng):  # reverse swell that lands ON the word (no transient)
    d = .42 * rng.uniform(.9, 1.15); t = t_(d)
    sw = sweep_noise(rng, d, 500, 7000) * (t / d) ** 2.5
    tone = np.sin(2 * np.pi * ROOT * 2 * semi(p) * t) * (t / d) ** 3 * .25
    out = filt(sw * .55 + tone, lo=250)
    return np.concatenate([out, np.zeros(int(.02 * SR))]) * g
def shimmer(g, p, rng):  # glassy bell (FM) for reveals: logos, results, payoff
    d = 1.8; t = t_(d); f = ROOT * 4 * semi(p) * (1 + rng.uniform(-.003, .003))
    bell = np.sin(2 * np.pi * f * t + 1.6 * np.exp(-t * 3) * np.sin(2 * np.pi * f * 3.5 * t)) * env_ad(len(t), .002, .55)
    return verb(bell * .6, rng, 1.2, .45) * g
def tap(g, p, rng):  # soft UI tap, tuned, varied
    d = .2; t = t_(d); f = ROOT * 2 * semi(p) * rng.uniform(.98, 1.02)
    s = np.sin(2 * np.pi * f * t) * env_ad(len(t), .001, .03) * .45
    k = filt(noise(rng, d), lo=1500, hi=5500) * env_ad(len(t), .0003, .004) * .25
    return (s + k) * g
def pulse(g, p, rng):  # deep felt heartbeat thump (emphasis without "impact")
    d = .9; t = t_(d); f = 52 * rng.uniform(.96, 1.04)
    return (np.sin(2 * np.pi * f * t) * env_ad(len(t), .006, .16) + filt(noise(rng, d), hi=180) * env_ad(len(t), .003, .05) * .5) * .62 * g
def whoosh(g, p, rng, d=None):
    d = d or rng.uniform(.5, .8); t = t_(d)
    n = sweep_noise(rng, d, rng.uniform(300, 500), rng.uniform(4500, 7500))
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** rng.uniform(1.6, 2.6)
    return filt(n, lo=180) * e * .7 * g
def swipe(g, p, rng): return whoosh(g, p, rng, rng.uniform(.28, .38))
def sweep(g, p, rng):  # filtered rising tone for the payback curve
    d = 1.4; t = t_(d); fr = ROOT * semi(p) * (1 + t / d)
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * (t / d) ** 1.5 * np.exp(-np.maximum(0, t - d * .9) / .05) * .25
    return (s + filt(sweep_noise(rng, d, 400, 4000), lo=300) * (t / d) ** 2 * .25) * g
def tape(g, p, rng):  # pitch-down tension drop ("are my systems ready?")
    d = .6; t = t_(d); fr = 420 * np.exp(-t * 3.2)
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_ad(len(t), .005, .25) * .35
    return (s + filt(noise(rng, d), hi=900) * env_ad(len(t), .004, .15) * .25) * g
def riser(g, p, rng, d=1.6):
    t = t_(d); n = sweep_noise(rng, d, 300, 9000) * (t / d) ** 2
    tone = np.sin(2 * np.pi * (ROOT * t + ROOT * t * t / d)) * (t / d) ** 3 * .22
    return np.concatenate([(n * .6 + tone), np.zeros(int(.05 * SR))]) * g
def riser_short(g, p, rng): return riser(g, p, rng, .7)
def ticks(g, p, rng, d=.95):  # count-up "data rush": airy, rising, no clicks
    t = t_(d); e = (t / d) ** 1.4 * np.exp(-np.maximum(0, t - d * .85) / .06)
    air = filt(sweep_noise(rng, d, 700, 5200), lo=400) * .35
    tone = sum(np.sin(2 * np.pi * f * t * (1 + .03 * t / d)) for f in (ROOT * 3, ROOT * 4.49, ROOT * 6)) * .05
    return (air + tone) * e * .8 * g
def chime(g, p, rng, notes=(659.25, 523.25, 392.0)):
    out = np.zeros(int((1.7 + .32 * len(notes)) * SR))
    for k, f in enumerate(notes):
        t = t_(1.6); s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t)) * env_ad(len(t), .004, .55)
        i = int(k * .32 * SR); out[i:i + len(s)] += s
    return out * .35 * g
def chime_end(g, p, rng): return verb(chime(g, p, rng, (293.66, 440.0, 587.33, 880.0)), rng, 1.6, .4)
def flip(g, p, rng):  # split-flap card: two-part clack, varied
    d = .09; c = filt(noise(rng, d), lo=rng.uniform(1200, 2200), hi=6000) * env_ad(int(d * SR), .0005, .008)
    c2 = np.zeros_like(c); j = int(rng.uniform(.018, .03) * SR); c2[j:] = c[:-j] * .5
    return (c * .5 + c2) * g
def truck(g, p, rng):
    d = 1.8; t = t_(d); rumble = filt(noise(rng, d), hi=160) * 2.2 + np.sin(2 * np.pi * 42 * t) * .3
    e = np.minimum(1, t / .3) * np.exp(-np.maximum(0, t - 1.1) / .25)
    brake = filt(noise(rng, .25), lo=3000) * np.linspace(.2, 0, int(.25 * SR))
    out = rumble * e; i = int(1.45 * SR); out[i:i + len(brake)] += brake[:len(out) - i]
    return out * .55 * g
def sub(g, p, rng): d = 2.5; t = t_(d); return np.sin(2 * np.pi * 34 * t) * env_ad(len(t), .2, 1.0) * .6 * g
def clock(g, p, rng):
    out = np.zeros(int(2.6 * SR))
    for k in range(5):
        d = .03; t = t_(d); s = np.sin(2 * np.pi * (1800 if k % 2 else 1400) * t) * env_ad(len(t), .0003, .004) * 1.2
        i = int(k * .5 * SR); out[i:i + len(s)] += s
    return out * g

GEN = {k: v for k, v in globals().items() if callable(v) and k in (
    'boom card stab lock accent shimmer tap pulse whoosh swipe sweep tape riser riser_short ticks chime chime_end flip truck sub clock').split()}
END_ON_TIME = {'riser', 'riser_short', 'accent'}  # these build INTO their timestamp

cues = json.load(open('build/sfx.json'))
mix = np.zeros(DUR * SR + SR * 4)
for idx, c in enumerate(cues):
    rng = np.random.default_rng(1000 + idx)
    s = GEN[c['type']](c['gain'], c.get('p', 0), rng)
    i = int(c['t'] * SR)
    if c['type'] in END_ON_TIME:
        tail = int(.05 * SR) if c['type'] != 'accent' else int(.02 * SR)
        i -= len(s) - tail
    if i < 0: s = s[-i:]; i = 0
    mix[i:i + len(s)] += s[:len(mix) - i]
mix = mix[:DUR * SR]
mix = np.tanh(mix * .9) * .55
st = np.stack([mix, mix], 1)
sf.write('build/sfx.wav', st, SR, subtype='PCM_24')
from collections import Counter
print('sfx', len(cues), dict(Counter(c['type'] for c in cues)))
