# Mix dialogue + SFX, normalize, and mux with the rendered picture.
# Mix is normalized to -16 LUFS integrated so there is headroom for the music + voiceover
# you add in the final edit (master the finished piece to -14 LUFS).
import json, subprocess, numpy as np, soundfile as sf, re
d, sr = sf.read('build/dialogue.wav'); s, _ = sf.read('build/sfx.wav')
n = min(len(d), len(s)); d, s = d[:n], s[:n]
SFX_GAIN = 0.55
mix = d + s * SFX_GAIN
sf.write('build/_mix.wav', mix, sr, subtype='PCM_24')
out = subprocess.run(['ffmpeg', '-hide_banner', '-i', 'build/_mix.wav', '-af', 'loudnorm=I=-16:TP=-1.5:print_format=json', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
m = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', out).group(0))
gain = 10 ** ((-16 - float(m['input_i'])) / 20)
peak = np.abs(mix).max() * gain
if peak > 0.84: gain *= 0.84 / peak  # keep true-peak headroom
print('measured', m['input_i'], 'LUFS  gain', round(20 * np.log10(gain), 2), 'dB')
import os; os.makedirs('../output/stems', exist_ok=True)
sf.write('../output/stems/dialogue.wav', d * gain, sr, subtype='PCM_24')
sf.write('../output/stems/sfx.wav', s * SFX_GAIN * gain, sr, subtype='PCM_24')
sf.write('../output/stems/dialogue_plus_sfx.wav', mix * gain, sr, subtype='PCM_24')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/video.mp4', '-i', '../output/stems/dialogue_plus_sfx.wav',
                '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart',
                '../output/SCIA2026_Highlight_v1.mp4'], check=True)
print('done')
