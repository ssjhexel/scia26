# Synthesizes the intro and outro stings in code (no samples): a warm D-major pad, glassy chimes on the logo
# reveal, and soft air on the moves. Restrained by design: it sits under a business audience, not over it.
# Usage: python3 sting.py <outdir>  ->  intro.wav (8 s) and outro.wav (7 s), 48 kHz stereo, about -21 LUFS
import sys, numpy as np, soundfile as sf
SR = 48000
rng = np.random.default_rng(7)
def t_(d): return np.arange(int(d * SR)) / SR
def filt(x, lo=None, hi=None, order=4):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    if hi: X *= 1 / (1 + (f / hi) ** order)
    if lo: X *= 1 - 1 / (1 + (f / lo) ** order)
    return np.fft.irfft(X, len(x))
def verb(x, size=2.2, mix=.35, seed=1):
    r = np.random.default_rng(seed); L = int(size * SR)
    ir = r.standard_normal((2, L)) * np.exp(-np.arange(L) / (SR * size / 6))
    ir = np.stack([filt(c, lo=180, hi=7000) for c in ir]); ir /= np.abs(ir).sum(1, keepdims=True) ** .5 * 8
    n = x.shape[1] + L; X = np.fft.rfft(x, n)
    wet = np.fft.irfft(X * np.fft.rfft(ir, n), n)
    out = np.zeros((2, n)); out[:, :x.shape[1]] += x * (1 - mix); out += wet * mix
    return out
def place(buf, x, t, pan=0.0, g=1.0):
    i = int(t * SR); x = np.atleast_2d(x)
    if x.shape[0] == 1: x = np.vstack([x[0] * np.sqrt(.5 - pan / 2) * 1.414, x[0] * np.sqrt(.5 + pan / 2) * 1.414])
    n = min(x.shape[1], buf.shape[1] - i); buf[:, i:i + n] += x[:, :n] * g
def note(hz): return 440 * 2 ** ((hz - 69) / 12)
D = {'D2': 38, 'A2': 45, 'D3': 50, 'F#3': 54, 'A3': 57, 'E4': 64, 'D5': 74, 'F#5': 78, 'A5': 81, 'E6': 88, 'D6': 86, 'F#6': 90, 'A6': 93}

def pad(d, notes, a=1.4, r=1.4):
    t = t_(d); out = np.zeros_like(t)
    for k, n in enumerate(notes):
        f = note(D[n]); det = 1 + .0018 * np.sin(2 * np.pi * (.13 + k * .05) * t)
        ph = 2 * np.pi * np.cumsum(f * det) / SR
        out += (np.sin(ph) + .22 * np.sin(2 * ph) + .08 * np.sin(3 * ph)) / (1 + k * .35)
    env = np.minimum(1, t / a) * np.minimum(1, (d - t) / r).clip(0)
    out = filt(out * env, hi=2200)
    return np.vstack([out, np.roll(out, 240)]) * .2
def chime(n, dec=2.6, bright=1.0):
    t = t_(dec * 2); f = note(D[n]); x = np.zeros_like(t)
    for m, (ratio, g) in enumerate([(1, 1), (2.01, .32 * bright), (3.02, .12 * bright), (4.17, .06 * bright)]):
        x += g * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (dec / (1 + m * .9)))
    x *= np.minimum(1, t / .004)
    return x * .22
def air(d, f0, f1, g=.06):
    n = rng.standard_normal(int(d * SR)); out = np.zeros_like(n); seg = 2048
    for i in range(0, len(n), seg):
        c = f0 * (f1 / f0) ** (i / len(n)); ch = n[i:i + seg]
        out[i:i + len(ch)] = filt(np.pad(ch, (0, seg - len(ch))), lo=c * .5, hi=c)[:len(ch)]
    t = np.arange(len(out)) / SR; env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    return out * env * g
def whoosh(d=.7, g=.05):
    return air(d, 500, 3500, g)

def master(buf, lufs=-21.0):
    # simple integrated-loudness match (K-weighting approximated by a high-shelf/high-pass), then a soft limiter
    k = np.stack([filt(c, lo=60, order=2) for c in buf]); k = k + .58 * np.stack([filt(c, lo=1500, order=2) for c in buf])
    blk = int(.4 * SR); hop = blk // 4; ms = []
    for i in range(0, k.shape[1] - blk, hop):
        e = (k[:, i:i + blk] ** 2).mean(1).sum();
        if e > 0: ms.append(e)
    ms = np.array(ms); L = -0.691 + 10 * np.log10(ms + 1e-12); ms = ms[L > -70]
    cur = -0.691 + 10 * np.log10(ms.mean())
    buf = buf * 10 ** ((lufs - cur) / 20)
    return np.tanh(buf * 1.2) / 1.2

def intro():
    d = 8.0; b = np.zeros((2, int(d * SR) + SR * 3))
    place(b, pad(8.0, ['D2', 'A2', 'F#3', 'A3', 'E4'], a=1.6, r=1.3), 0)
    place(b, air(1.9, 300, 6000, .05), .1, -.3)               # light sweep
    for k, (n, dt, pan) in enumerate([('D5', 0, -.25), ('A5', .05, .2), ('F#6', .1, -.05), ('E6', .16, .3)]):
        place(b, chime(n, 2.8), .48 + dt, pan, .9 - k * .12)  # logo reveal
    place(b, whoosh(.8, .045), 2.15, .35)                     # lockup settles
    for k, n in enumerate(['A5', 'D6', 'F#6']):
        place(b, chime(n, 1.6, .6), 2.86 + k * .085, -.3 + k * .3, .38)  # title reveal
    place(b, chime('A6', 1.2, .4), 3.62, .25, .16)            # speakers
    place(b, air(1.2, 2500, 400, .035), 6.85, 0)               # out to the talk
    b = verb(b, 2.4, .32)[:, :int(d * SR)]
    fade = np.ones(b.shape[1]); n = int(.25 * SR); fade[-n:] = np.linspace(1, 0, n) ** 2
    return master(b * fade)

def outro():
    d = 7.0; b = np.zeros((2, int(d * SR) + SR * 3))
    place(b, pad(7.0, ['D2', 'A2', 'D3', 'F#3', 'A3'], a=1.0, r=1.6), 0)
    for k, (n, dt, pan) in enumerate([('A5', 0, .2), ('D6', .06, -.2), ('F#6', .12, .1)]):
        place(b, chime(n, 3.0), .36 + dt, pan, .85 - k * .12)
    place(b, chime('A5', 1.8, .6), 1.78, -.25, .32); place(b, chime('D6', 2.4, .6), 1.92, .25, .34)
    b = verb(b, 2.6, .34)[:, :int(d * SR)]
    t = np.arange(b.shape[1]) / SR; fade = np.clip((6.95 - t) / .9, 0, 1) ** 1.5
    return master(b * fade)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    sf.write(f'{out}/intro.wav', intro().T, SR, subtype='PCM_24')
    sf.write(f'{out}/outro.wav', outro().T, SR, subtype='PCM_24')
    print('stings written to', out)
