# Assemble the dialogue stem from the Phase 1 rough cut using timeline.json,
# and write a per-frame loudness envelope (env.json) for audio-reactive graphics.
import json, numpy as np, soundfile as sf
tl = json.load(open('timeline.json'))
a, sr = sf.read('assets/dialogue_src.wav')
N = int(tl['duration'] * sr)
out = np.zeros((N, 2))
F = int(0.012 * sr)
for c in tl['clips']:
    s0, s1 = (int(x * sr) for x in c['src'])
    seg = a[s0:s1].copy()
    ramp = np.linspace(0, 1, F)[:, None]
    seg[:F] *= ramp; seg[-F:] *= ramp[::-1]
    d0 = int(c['dst'] * sr)
    out[d0:d0 + len(seg)] += seg
sf.write('build/dialogue.wav', out, sr, subtype='PCM_24')
fps = tl['fps']; hop = sr // fps
mono = out.mean(1)
env = [float(np.sqrt((mono[i*hop:(i+1)*hop]**2).mean() + 1e-12)) for i in range(N // hop)]
m = max(env)
json.dump([round(min(1, e / m * 1.6), 3) for e in env], open('build/env.json', 'w'))
print('dialogue ok', len(env))
