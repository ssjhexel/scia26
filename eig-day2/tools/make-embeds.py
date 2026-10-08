"""Generate WordPress Custom HTML embeds from site/index.html and site/watch.html.

usage: python3 tools/make-embeds.py [ASSET_BASE] [SALES_URL] [WATCH_URL]
defaults: /wp-content/uploads/eig-ondemand/  /day-2-on-demand/  /day-2-on-demand/watch/
"""
import re, sys, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'site'
base = (sys.argv[1] if len(sys.argv) > 1 else '/wp-content/uploads/eig-ondemand/').rstrip('/') + '/'
sales = sys.argv[2] if len(sys.argv) > 2 else '/day-2-on-demand/'
watch = sys.argv[3] if len(sys.argv) > 3 else '/day-2-on-demand/watch/'

def block(page):
    html = (root / page).read_text()
    body = re.search(r'<!-- EIGOD:START -->(.*?)<!-- EIGOD:END -->', html, re.S).group(1)
    # relative asset/page references -> absolute
    body = re.sub(r'(src|href|srcset)="(assets/|css/|js/)', lambda m: f'{m.group(1)}="{base}{m.group(2)}', body)
    body = re.sub(r'(\d+w, )(assets/)', lambda m: m.group(1) + base + m.group(2), body)
    body = body.replace('href="index.html"', f'href="{sales}"').replace('href="watch.html"', f'href="{watch}"')
    scripts = re.findall(r'<script src="([^"]+)"></script>', html)
    overrides = {'assetBase': base, 'videoBase': base + 'videos', 'salesUrl': sales, 'watchUrl': watch}
    head = (f'<!-- EIG Day 2 On-Demand: generated from site/{page} by tools/make-embeds.py. Paste into a Custom HTML block. -->\n'
            f'<link rel="preload" as="font" type="font/woff2" href="{base}assets/fonts/InstrumentSerif-normal-400-latin.woff2" crossorigin>\n'
            f'<link rel="stylesheet" href="{base}css/fonts.css">\n<link rel="stylesheet" href="{base}css/eigod.css">\n')
    tail = f'<script>window.EIGOD_OVERRIDES = {json.dumps(overrides)};</script>\n' + \
           ''.join(f'<script src="{base}{s}"></script>\n' for s in scripts)
    return head + body.strip() + '\n' + tail

out = root / 'wordpress'; out.mkdir(exist_ok=True)
(out / 'sales-embed.html').write_text(block('index.html'))
(out / 'watch-embed.html').write_text(block('watch.html'))
print('wrote', out / 'sales-embed.html', out / 'watch-embed.html', 'base =', base)
