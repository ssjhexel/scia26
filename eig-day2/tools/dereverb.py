"""Tame room reverb on a short speech clip (used for the trailer's cold-open soundbite).
   python3 tools/dereverb.py in.wav out.wav [rt60=0.55] [floor_db=-16]
1. Late-reverb suppression (Lebart-style): the late tail at frame t is predicted from the signal ~50 ms earlier,
   decayed by the room's RT60; a smoothed spectral gain removes that predicted energy.
2. Gentle downward expander so the tails in pauses fall away faster.
3. EQ: -3 dB around 350 Hz (room boxiness), +2 dB around 4 kHz (presence)."""
import sys, numpy as np, soundfile as sf

def stft(x, n=1024, h=256):
    w = np.hanning(n); pad = np.pad(x, (n, n))
    frames = np.lib.stride_tricks.sliding_window_view(pad, n)[::h] * w
    return np.fft.rfft(frames, axis=1), w
def istft(X, w, length, n=1024, h=256):
    frames = np.fft.irfft(X, n, axis=1) * w
    out = np.zeros(len(frames) * h + n); norm = np.zeros_like(out)
    for i, f in enumerate(frames): out[i * h:i * h + n] += f; norm[i * h:i * h + n] += w ** 2
    out /= np.maximum(norm, 1e-8)
    return out[n:n + length]

def dereverb(x, sr, rt60=.55, floor_db=-16, n=1024, h=256):
    X, w = stft(x, n, h); P = np.abs(X) ** 2
    Ps = P.copy()
    for t in range(1, len(P)): Ps[t] = .65 * Ps[t - 1] + .35 * P[t]        # temporal smoothing
    d = max(1, int(round(.05 * sr / h))); delta = 3 * np.log(10) / rt60
    late = np.zeros_like(Ps); late[d:] = np.exp(-2 * delta * d * h / sr) * Ps[:-d]
    G = np.clip(1 - 1.2 * late / (Ps + 1e-12), 10 ** (floor_db / 20), 1.0)
    # smooth the gain across time and frequency (avoids musical-noise artefacts)
    k = np.ones(5) / 5
    G = np.apply_along_axis(lambda g: np.convolve(g, k, 'same'), 1, G)
    G = np.apply_along_axis(lambda g: np.convolve(g, np.ones(3) / 3, 'same'), 0, G)
    return istft(X * G, w, len(x), n, h)

def expander(x, sr, thr_db, ratio=2.0, att=.004, rel=.08):
    env = np.abs(x); a, r = np.exp(-1 / (att * sr)), np.exp(-1 / (rel * sr)); e = np.zeros_like(x); s = 0.0
    for i, v in enumerate(env):
        c = a if v > s else r; s = c * s + (1 - c) * v; e[i] = s
    lvl = 20 * np.log10(e + 1e-9); under = np.minimum(0, lvl - thr_db)
    return x * 10 ** (under * (ratio - 1) / 20)

def peq(x, sr, f0, gain_db, q):
    # RBJ peaking biquad
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / sr; al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w0), 1 - al * A]); a = np.array([1 + al / A, -2 * np.cos(w0), 1 - al / A])
    b, a = b / a[0], a / a[0]; y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = b[0] * v + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        x2, x1, y2, y1 = x1, v, y1, o; y[i] = o
    return y

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    rt60 = float(sys.argv[3]) if len(sys.argv) > 3 else .55
    floor = float(sys.argv[4]) if len(sys.argv) > 4 else -16
    x, sr = sf.read(src, always_2d=True); m = x.mean(1)
    y = dereverb(m, sr, rt60, floor)
    peak = 20 * np.log10(np.percentile(np.abs(y), 99.5) + 1e-9)
    y = expander(y, sr, peak - 32, 2.0)
    y = peq(y, sr, 350, -3, .9); y = peq(y, sr, 4000, 2, .8)
    y *= np.sqrt(np.mean(m ** 2)) / (np.sqrt(np.mean(y ** 2)) + 1e-12)        # keep the same level
    sf.write(dst, np.vstack([y, y]).T, sr, subtype='PCM_24')
    print('wrote', dst)
