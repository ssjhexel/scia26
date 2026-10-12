# Fit a supplied music track (Suno, 120 BPM) to the trailer's cut points, then mix the soundbites over it.
# Usage: python3 fit_music.py <track.wav> <bites dir> <out dir>  ->  music.wav, voice.wav, mix.wav
# The track was measured at 120.1 BPM; every source and target point below sits on its beat grid.
import sys, numpy as np, soundfile as sf
from sting import filt, verb
SR = 48000; DUR = 30.0; N = int(DUR * SR)
rng = np.random.default_rng(5)

# (track start, track end, trailer start); trailer end = start + length
SEGMENTS = [
    (0.151, 4.151, 0.0),     # intro swell; the first impact lands on the brand hit at 4.0
    (4.151, 11.651, 4.0),    # main theme under the montage and Aaron
    (19.636, 22.136, 11.5),  # the break ("If trust is present…"); the build kicks in at 14.0
    (27.625, 30.125, 14.0),  # pre-climax build under Greg
    (30.125, 38.118, 16.5),  # climax: stat hits, faces, ends as the end card lands
    (38.118, 39.96, 24.493), # the track's own ring-out
]
XF = 0.03  # 30 ms equal-power crossfade at each join, centred on the beat

src, sr = sf.read(sys.argv[1], always_2d=True)
assert sr == SR, sr
src = src.T
bed = np.zeros((2, N + SR * 6))
for k, (a, b, t0) in enumerate(SEGMENTS):
    pre = XF / 2 if k else 0
    i0, i1 = int((a - pre) * SR), int((b + XF / 2) * SR)
    seg = src[:, max(0, i0):min(src.shape[1], i1)].copy()
    n = seg.shape[1]; f = int(XF * SR)
    if k: seg[:, :f] *= np.sin(np.linspace(0, np.pi / 2, f)) ** 2
    if k < len(SEGMENTS) - 1: seg[:, n - f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
    j = int((t0 - pre) * SR); bed[:, j:j + n] += seg

# extend the ending: a reverb "freeze" of the climax's last chord, under the track's own tail
chord = src[:, int(37.62 * SR):int(38.10 * SR)].copy()
chord *= np.hanning(chord.shape[1])
L = int(5.5 * SR); ir = rng.standard_normal((2, L)) * np.exp(-np.arange(L) / (SR * 1.15))
ir = np.stack([filt(c, lo=120, hi=5200) for c in ir]); ir /= np.abs(ir).sum(1, keepdims=True) ** .5 * 14
n = chord.shape[1] + L
wet = np.fft.irfft(np.fft.rfft(chord, n) * np.fft.rfft(ir, n), n)
tail_ref = np.sqrt(np.mean(src[:, int(38.3 * SR):int(38.8 * SR)] ** 2))
wet *= tail_ref / (np.sqrt(np.mean(wet[:, :int(.5 * SR)] ** 2)) + 1e-9) * .9
j = int(24.493 * SR); bed[:, j:j + n] += wet[:, :bed.shape[1] - j]

# light reinforcement on the picture's accents (untuned, so it can't clash with the track's key)
def boom(g):
    t = np.arange(int(2.6 * SR)) / SR
    sub = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t * 6)) / SR) * np.exp(-t / .9) * np.minimum(1, t / .003)
    body = filt(rng.standard_normal(len(t)), hi=320) * np.exp(-t / .22) * .6
    return verb(np.vstack([sub + body, sub + body]) * g, 1.4, .25, seed=4)
def put(x, t, g=1.0):
    i = int(t * SR); m = min(x.shape[1], bed.shape[1] - i); bed[:, i:i + m] += x[:, :m] * g
src_rms = np.sqrt(np.mean(src ** 2))
for t, g in [(4.0, .55), (16.5, .4), (17.5, .32), (18.5, .32), (19.5, .32), (24.493, .7)]: put(boom(1.0), t, g * src_rms * 4)

# voices: same placement, level and two-band ducking as the synthesized score
VOICES = [('jose', .35), ('aaron', 7.64), ('greg', 12.1), ('hosni', 21.2)]
voice = np.zeros_like(bed); duck = np.ones(bed.shape[1])
for name, t0 in VOICES:
    v, vsr = sf.read(f'{sys.argv[2]}/{name}.wav', always_2d=True); v = v.T
    rms = np.sqrt(np.mean(v[:, np.abs(v).max(0) > .01] ** 2) + 1e-12)
    v = v * (10 ** (-17 / 20) / rms); v = filt(v[0], lo=90); v = np.vstack([v, v])
    i = int(t0 * SR); voice[:, i:i + v.shape[1]] += v
    duck[int((t0 - .12) * SR):int((t0 + v.shape[1] / SR + .2) * SR)] = 0
k = int(.08 * SR); pres = 1 - np.convolve(duck, np.ones(k) / k, 'same')
low = np.stack([filt(c, hi=250) for c in bed]); high = bed - low
bed = low * (1 - .5 * pres) + high * (1 - .82 * pres)

# bed level: about -21 dBFS RMS outside the voices, matching the talks' sense of loudness after mastering
outside = duck[:N] > .5
g = 10 ** (-21 / 20) / (np.sqrt(np.mean(bed[:, :N][:, outside] ** 2)) + 1e-9)
fade = np.ones(N); fade[int(28.8 * SR):] = np.linspace(1, 0, N - int(28.8 * SR)) ** 1.6
music = np.tanh(bed[:, :N] * g * 1.05) / 1.05 * fade
mix = np.tanh((music + voice[:, :N]) * 1.02) / 1.02 * fade
out = sys.argv[3]
sf.write(f'{out}/music.wav', music.T, SR, subtype='PCM_24')
sf.write(f'{out}/voice.wav', voice[:, :N].T, SR, subtype='PCM_24')
sf.write(f'{out}/mix.wav', mix.T, SR, subtype='PCM_24')
print('fitted', sys.argv[1], '->', out)
