# EIG Day 2 trailer score: synthesized in code (no samples), 120 BPM in D, locked to trailer.js.
# Usage: python3 score.py <bites dir> <out dir>  ->  music.wav (score only) and mix.wav (score + soundbites, ducked)
import sys, numpy as np, soundfile as sf
from sting import filt, verb, chime, air
SR = 48000; DUR = 30.0; N = int(DUR * SR)
rng = np.random.default_rng(11)
BEAT = 0.5
def t_(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def st(x, pan=0.0):
    if x.ndim == 2: return x
    return np.vstack([x * np.sqrt(.5 - pan / 2) * 1.414, x * np.sqrt(.5 + pan / 2) * 1.414])
BUS = {k: np.zeros((2, N + SR * 4)) for k in ['drums', 'bass', 'music', 'fx', 'voice']}
def put(bus, x, t, g=1.0, pan=0.0):
    x = st(x, pan); i = int(t * SR); n = min(x.shape[1], BUS[bus].shape[1] - i)
    if n > 0: BUS[bus][:, i:i + n] += x[:, :n] * g

# ---------------------------------------------------------------- instruments
def kick(g=1.0):
    t = t_(.5); f = 45 + 95 * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, .22)
    click = filt(rng.standard_normal(len(t)), lo=1500, hi=6000) * env(len(t), .0005, .006) * .35
    return np.tanh((body + click) * 1.6) * .8 * g
def clap(g=1.0):
    d = .45; n = int(d * SR); x = np.zeros(n)
    for k, off in enumerate([0, .011, .022, .034]):
        i = int(off * SR); b = filt(rng.standard_normal(n - i), lo=900, hi=5200) * env(n - i, .001, .012 if k < 3 else .12)
        x[i:] += b * (.8 if k < 3 else 1)
    return verb(st(x * .55 * g), .9, .28, seed=3)
def hat(open_=False, g=1.0):
    d = .3 if open_ else .06; n = int(d * SR)
    return filt(rng.standard_normal(n), lo=7000) * env(n, .001, .09 if open_ else .014) * .28 * g
def bass(m, d, g=1.0):
    t = t_(d); f = hz(m)
    x = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t) + .12 * np.sin(2 * np.pi * 3 * f * t)
    e = np.minimum(1, t / .01) * np.minimum(1, (d - t) / .06).clip(0)
    return filt(x * e, hi=420) * .42 * g
def pluck(m, g=1.0, bright=1.0):
    d = .5; t = t_(d); f = hz(m) * (1 + rng.uniform(-.002, .002))
    saw = sum(np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (6 + 9 * k / bright)) for k in range(1, 9))
    return saw * env(len(t), .002, .16) * .16 * g
def pad(ms, d, g=1.0, a=.6, r=.8, hi=1900):
    t = t_(d); x = np.zeros_like(t)
    for k, m in enumerate(ms):
        f = hz(m)
        for det in (-.004, 0, .0045):
            ph = 2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28)
            x += (np.sin(ph) + .5 * np.sin(2 * ph) + .25 * np.sin(3 * ph) + .12 * np.sin(4 * ph)) / (1 + k * .25)
    e = np.minimum(1, t / a) * np.minimum(1, (d - t) / r).clip(0)
    y = filt(x * e, hi=hi) * .05 * g
    return np.vstack([y, np.roll(y, 360)])
def boom(g=1.0):
    d = 3.2; t = t_(d)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 70 * np.exp(-t * 5)) / SR) * env(len(t), .003, 1.1)
    body = filt(rng.standard_normal(len(t)), hi=380) * env(len(t), .002, .3) * .8
    hit = filt(rng.standard_normal(len(t)), lo=2000, hi=9000) * env(len(t), .001, .05) * .25
    return verb(st((sub + body + hit) * .9 * g), 1.8, .32, seed=5)
def crash(g=1.0):
    d = 2.6; n = int(d * SR); return verb(st(filt(rng.standard_normal(n), lo=4500) * env(n, .002, .7) * .22 * g), 1.2, .3, seed=9)
def rev_cym(d=1.0, g=1.0):
    n = int(d * SR); x = filt(rng.standard_normal(n), lo=3500) * env(n, .001, d / 3.5) * .3 * g
    return x[::-1].copy()
def riser(d, m0, m1, g=1.0):
    t = t_(d); f = hz(m0) * (hz(m1) / hz(m0)) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = sum(np.sin(ph * k) / k for k in range(1, 6)) * .08
    x = (tone + air(d, 400, 9000, .09)[:len(t)]) * (t / d) ** 2.2
    return filt(x, lo=120) * g
def roll(t0, d, g=1.0):
    n = int(d / .0625)
    for k in range(n): put('drums', clap(.25 + .75 * (k / n) ** 2) * .6, t0 + k * .0625, g * (.35 + .65 * k / n))

# ---------------------------------------------------------------- arrangement
CH = {'D': (38, [62, 66, 69, 76]), 'Bm': (35, [59, 62, 66, 69]), 'G': (31, [55, 59, 62, 69]), 'A': (33, [57, 61, 64, 71]), 'Asus': (33, [57, 62, 64, 71])}
ARP = {'D': [62, 69, 74, 78, 76, 69, 74, 81], 'Bm': [59, 66, 71, 74, 73, 66, 71, 78], 'G': [55, 62, 67, 71, 69, 62, 67, 74], 'A': [57, 64, 69, 73, 71, 64, 69, 76], 'Asus': [57, 64, 69, 74, 71, 64, 69, 76]}
def groove(t0, t1, chords, snare=True, arps=True, hats16=False, kick_g=1.0):
    t = t0
    while t < t1 - 1e-6:
        bpos = round((t - t0) / BEAT) % 4
        ch = chords[min(int((t - t0) // 2.0), len(chords) - 1)]
        if bpos in (0, 2): put('drums', kick(kick_g), t)
        if bpos == 3: put('drums', kick(.55 * kick_g), t + .25)
        if snare and bpos in (1, 3): put('drums', clap(.9), t, .8)
        for k in range(4 if hats16 else 2):
            put('drums', hat(open_=(not hats16 and k == 1 and bpos == 3)), t + k * (BEAT / (4 if hats16 else 2)), .9 if k % 2 == 0 else .6, pan=.25)
        if bpos == 0: put('bass', bass(CH[ch][0] + 12, 1.9), t)
        if arps:
            for k in range(4):
                put('music', pluck(ARP[ch][(round((t - t0) / BEAT) * 4 + k) % 8], .9, 1.4), t + k * .125, .8, pan=(-.35 if k % 2 else .35))
        t += BEAT
    # chord pads, one per 2 s
    for i, ch in enumerate(chords):
        a = t0 + i * 2.0; d = min(2.0, t1 - a)
        if d > .2: put('music', pad(CH[ch][1], d + .3, .9, a=.08, r=.35), a)

# A · cold open: drone + tension under Jose
put('music', pad([38, 45, 50], 4.2, 1.1, a=1.4, r=.4, hi=700), 0)
for k, tt in enumerate([.5, 1.0, 2.0, 2.5, 3.0, 3.25, 3.5, 3.75]): put('bass', bass(26 + 12, .22, .8 + k * .05), tt)
put('fx', riser(1.6, 50, 74, 1.0), 2.4); put('fx', rev_cym(1.1), 2.9)
# B · brand hit
put('fx', boom(1.0), 4.0); put('fx', crash(1.0), 4.0)
for k, (m, p) in enumerate([(74, -.3), (78, .2), (81, -.05), (88, .35)]): put('music', chime({74: 'D5', 78: 'F#5', 81: 'A5', 88: 'E6'}[m], 2.4), 4.02 + k * .05, .75 - k * .1, pan=p)
groove(4.0, 11.5, ['D', 'D', 'Bm', 'Bm', 'G', 'G', 'A', 'A'][:4] if False else ['D', 'Bm', 'G', 'A'])
put('fx', rev_cym(.6, .8), 10.9)
# C→D · drop at 11.5: silence, a single bell, pedal + ticking
put('music', chime('A6', 2.4, .5), 11.55, .5, pan=.2)
put('music', pad([38, 45, 57], 2.6, .9, a=.5, r=.6, hi=900), 11.5)
for k in range(5): put('music', pluck(81, .35, .7), 11.75 + k * .5, .6, pan=(.4 if k % 2 else -.4))
groove(14.0, 16.5, ['Bm', 'G'], snare=False, arps=True, hats16=True, kick_g=.8)
put('fx', riser(1.0, 57, 81, .8), 15.5); put('fx', rev_cym(.5), 16.0)
# E · stats: four accented hits
for k, ch in enumerate(['G', 'A', 'Bm', 'Asus']):
    t = 16.5 + k
    put('fx', boom(.55), t); put('drums', kick(1.1), t); put('drums', clap(1.0), t, .9); put('fx', crash(.5), t)
    put('music', pad(CH[ch][1], 1.0, 1.4, a=.01, r=.3, hi=3200), t)
    put('bass', bass(CH[ch][0] + 12, .95, 1.1), t)
    for j in range(8): put('drums', hat(), t + .25 + j * .0625, .5 + .06 * j, pan=.2)
    if k < 3: put('fx', rev_cym(.35, .7), t + .65)
# F · faces: full groove, snare roll into the final hit
groove(20.5, 24.5, ['G', 'A'], snare=True, arps=True, hats16=True)
roll(23.5, 1.0, .9); put('fx', riser(1.4, 57, 86, 1.1), 23.1); put('fx', rev_cym(1.0, 1.0), 23.5)
# G · end card: final hit and ring-out
put('fx', boom(1.2), 24.5); put('fx', crash(1.2), 24.5)
put('music', pad([50, 57, 62, 66, 69, 76], 5.5, 1.4, a=.02, r=2.5, hi=2600), 24.5)
put('bass', bass(38, 3.5, 1.0), 24.5)
for k, (n_, p) in enumerate([('D5', -.3), ('A5', .1), ('F#6', -.1), ('E6', .35)]): put('music', chime(n_, 3.2), 24.52 + k * .06, .8 - k * .1, pan=p)
for k, n_ in enumerate(['A5', 'D6', 'F#6']): put('music', chime(n_, 2.2, .7), 25.6 + k * .25, .4, pan=(-.3 + .3 * k))
for k in range(8): put('bass', bass(38, .2, .35 * (1 - k / 8)), 26.0 + k * .5)

# ---------------------------------------------------------------- voices + ducking
VOICES = [('jose', .35), ('aaron', 8.0), ('greg', 12.1), ('hosni', 21.2)]
duck = np.ones(N + SR * 4)
for name, t0 in VOICES:
    v, sr = sf.read(f'{sys.argv[1]}/{name}.wav', always_2d=True)
    assert sr == SR
    v = v.T
    rms = np.sqrt(np.mean(v[:, np.abs(v).max(0) > .01] ** 2) + 1e-12)
    v = v * (10 ** (-17 / 20) / rms)                     # every bite at the same speech level (-17 dBFS RMS)
    v = filt(v[0], lo=90); v = np.vstack([v, v])
    put('voice', v, t0)
    a, b = int((t0 - .12) * SR), int((t0 + v.shape[1] / SR + .2) * SR)
    duck[a:b] = np.minimum(duck[a:b], .4)
# two-band ducking: the low end dips a little (keeps the groove's weight), the mids/highs that fight speech dip ~14 dB
k = int(.08 * SR); pres = 1 - np.convolve(duck, np.ones(k) / k, 'same')   # 0 = no voice, ~0.6 = voice
pres = np.clip(pres / .6, 0, 1)
mus = (BUS['music'] * .9 + BUS['bass'] * 1.0 + BUS['drums'] * .85 + BUS['fx'] * .9)
mus = verb(mus, 1.6, .12, seed=21)[:, :N + SR * 4]
low = np.stack([filt(c, hi=250) for c in mus]); high = mus - low
mus = low * (1 - .5 * pres) + high * (1 - .8 * pres)
fade = np.ones(N); fade[int(29.0 * SR):] = np.linspace(1, 0, N - int(29.0 * SR)) ** 1.5
music = np.tanh(mus[:, :N] * 1.1) / 1.1 * fade
mix = music * .36 + BUS['voice'][:, :N]
mix = np.tanh(mix * 1.05) / 1.05 * fade
out = sys.argv[2]
sf.write(f'{out}/music.wav', music.T, SR, subtype='PCM_24')
sf.write(f'{out}/voice.wav', BUS['voice'][:, :N].T, SR, subtype='PCM_24')
sf.write(f'{out}/mix.wav', mix.T, SR, subtype='PCM_24')
print('score written', out)
