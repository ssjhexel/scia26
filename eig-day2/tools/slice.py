# Slice a tall screenshot into N columns side by side for review: python3 slice.py in.png out.png N scale
import sys
from PIL import Image
src, dst, n, sc = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
im = Image.open(src); w, h = im.size; step = -(-h // n)
cols = [im.crop((0, i * step, w, min(h, (i + 1) * step))) for i in range(n)]
W, H = int(w * sc), int(step * sc)
out = Image.new('RGB', (W * n + 10 * (n - 1), H), (255, 0, 255))
for i, c in enumerate(cols):
    out.paste(c.resize((W, int(c.height * sc))), (i * (W + 10), 0))
out.save(dst)
