# Clean + upscale the SupplyChainBrain logo (low-res JPG) into crisp transparent PNGs,
# and produce white (knockout) variants of all logos for dark backgrounds.
from PIL import Image, ImageFilter
import numpy as np
def ss(x,a,b):
    t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
src=Image.open('assets/scb_src.jpg').convert('RGB')
W,H=src.size; K=4
up=np.array(src.resize((W*K,H*K),Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.8))).astype(float)/255
r,g,b=up[...,0],up[...,1],up[...,2]
red=ss(r-np.maximum(g,b),0.36,0.46)            # red wordmark
dark=ss(1-np.maximum(np.maximum(r,g),b),0.35,0.6)*(1-red)*((r-np.maximum(g,b))<0.06)  # black tagline
out=np.zeros((H*K,W*K,4))
out[...,:3]=np.where(red[...,None]>0, [0xC4/255,0x12/255,0x30/255], [0.08,0.08,0.1])
out[...,3]=np.maximum(red,dark)
Image.fromarray((out*255).astype(np.uint8)).save('assets/scb.png')
wh=out.copy(); wh[...,:3]=1; Image.fromarray((wh*255).astype(np.uint8)).save('assets/scb_white.png')
for name,f in [('edge','assets/edge_src.png'),('cscmp','assets/cscmp_src.webp')]:
    im=Image.open(f).convert('RGBA'); im.save(f'assets/{name}.png')
    a=np.array(im).astype(float)
    # knockout: keep shapes, make blue -> white, white -> transparent (for the seal ring text)
    lum=a[...,:3].mean(-1)/255
    w=np.zeros_like(a); w[...,:3]=255; w[...,3]=a[...,3]*(1-ss(lum,0.75,0.95))
    Image.fromarray(w.astype(np.uint8)).save(f'assets/{name}_white.png')
print('done')
