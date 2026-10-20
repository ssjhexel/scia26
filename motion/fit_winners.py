# Fit the Suno track ("Triumph in D", ~122 BPM) to the winners film.
#   python3 fit_winners.py warp <track.wav> <beats.json>   -> build-winners/warp.json (output-time <-> film-time knots)
#   python3 fit_winners.py mix  <track.wav> <beats.json>   -> build-winners/music.wav, mix.wav (needs build-winners/sfx.wav)
# The film is authored on a 120 BPM grid (film beat n at 4 + n/2 s, after a 4 s intro). Each film beat is pinned to the
# track's own beat n, so the picture's hits land on the track's hits (title 4.13, WINNER 12.04, stage 16.0 ...).
# The track's 2-bar breakdown (beats 104-111) is lifted out, so the finale downbeat (beat 112) lands on the end card.
import sys, json, re, subprocess, numpy as np, soundfile as sf
SR = 48000; B = 'build-winners'
CUT, RESUME = 104, 112      # track beats: breakdown starts / finale downbeat
TAIL = 5.5                  # film seconds of end card after the finale hit
XF = 0.03                   # equal-power crossfade at the cut
mode, track, beats = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
t_cut = beats[CUT]; T = round((t_cut + TAIL) * 30) / 30

if mode == 'warp':
    knots = [[0, 0]] + [[beats[n], 4 + n / 2] for n in range(CUT + 1)] + [[t_cut + TAIL + 2, 4 + CUT / 2 + TAIL + 2]]
    json.dump({'knots': knots, 'duration': T}, open(f'{B}/warp.json', 'w'))
    print('warp', len(knots), 'knots, output', T, 's')
    sys.exit()

src, sr = sf.read(track, always_2d=True); assert sr == SR, sr
src = src.T; N = int(T * SR); f = int(XF * SR)
a = src[:, :int(t_cut * SR) + f // 2].copy(); a[:, -f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
j = int(beats[RESUME] * SR) - f // 2
b = src[:, j:j + N - a.shape[1] + f].copy(); b[:, :f] *= np.sin(np.linspace(0, np.pi / 2, f)) ** 2
music = np.zeros((2, N)); music[:, :a.shape[1]] += a
k = a.shape[1] - f; m = min(b.shape[1], N - k); music[:, k:k + m] += b[:, :m]
fade = np.ones(N); n0 = int((T - 1.2) * SR); fade[n0:] = np.linspace(1, 0, N - n0) ** 1.5
music *= fade

sfx, _ = sf.read(f'{B}/sfx.wav', always_2d=True); sfx = sfx.T[:, :N]
sfx = np.pad(sfx, ((0, 0), (0, N - sfx.shape[1])))
def lufs(x):
    sf.write(f'{B}/_m.wav', x.T, SR, subtype='PCM_24')
    o = subprocess.run(['ffmpeg', '-hide_banner', '-i', f'{B}/_m.wav', '-af', 'loudnorm=I=-16:TP=-1.5:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    return float(json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', o).group(0))['input_i'])
# music leads; the designed SFX sit about 9 dB under it so they read as accents, not a second score
gm = 10 ** ((-16 - lufs(music)) / 20); gs = 10 ** ((-25 - lufs(sfx)) / 20)
mix = music * gm + sfx * gs
g = 10 ** ((-16 - lufs(mix)) / 20); mix *= g
if np.abs(mix).max() > .89: mix = np.tanh(mix / .89) * .89   # soft ceiling for any overs
print('final', round(lufs(mix), 2), 'LUFS  peak', round(20 * np.log10(np.abs(mix).max()), 2), 'dBFS')
sf.write(f'{B}/music.wav', (music * gm * g).T, SR, subtype='PCM_24')
sf.write(f'{B}/mix.wav', mix.T, SR, subtype='PCM_24')
