"""Scan the master once per second: is it PowerPoint Presenter View (clean slide crop) or something else
(editor / desktop / email)? Also stores a tiny thumbnail of the slide area for slide-change detection.
Output: work/scan.npz  (t, pv, stripMean, stripStd, thumb[32x18])"""
import subprocess, numpy as np, sys
SRC = sys.argv[1]; OUT = sys.argv[2]
W, H = 480, 270  # quarter res; slide rect at full res ~ x 24..1251, y 150..841
cmd = ['ffmpeg', '-v', 'error', '-i', SRC, '-vf', f'fps=1,scale={W}:{H}:flags=area,format=gray', '-f', 'rawvideo', '-']
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=W * H * 8)
ts, sm, ss, thumbs, top, tool = [], [], [], [], [], []
i = 0
while True:
    b = p.stdout.read(W * H)
    if len(b) < W * H: break
    f = np.frombuffer(b, np.uint8).reshape(H, W).astype(np.float32)
    # strips that are plain dark chrome in Presenter View
    left = f[40:208, 0:5]; gap = f[40:208, 314:319]; topb = f[3:30, 60:300]; under = f[214:228, 0:310]
    strips = np.concatenate([left.ravel(), gap.ravel(), under.ravel()])
    ts.append(i); sm.append(strips.mean()); ss.append(strips.std()); top.append(topb.mean())
    slide = f[38:210, 6:313]
    th = slide.reshape(172 // 4 * 4 // 4, 4, -1, 1)[:, :, :, 0] if False else None
    # 32x18 thumbnail of the slide area
    ys = np.linspace(38, 210, 19).astype(int); xs = np.linspace(6, 313, 33).astype(int)
    thumbs.append(np.array([[f[ys[a]:ys[a + 1], xs[c]:xs[c + 1]].mean() for c in range(32)] for a in range(18)], np.float32))
    i += 1
    if i % 1000 == 0: print(i, flush=True)
sm, ss, top = map(np.array, (sm, ss, top))
pv = (sm < 45) & (ss < 14) & (top < 70)
np.savez_compressed(OUT, t=np.array(ts), pv=pv, sm=sm, ss=ss, top=top, thumb=np.array(thumbs))
print('frames', i, 'pv share', pv.mean().round(3))
