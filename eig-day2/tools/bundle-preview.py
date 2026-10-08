"""Bundle a page into one self-contained HTML file (for sharing a clickable preview)."""
import re, base64, pathlib, sys, mimetypes, json
root = pathlib.Path(__file__).resolve().parent.parent / 'site'
mimetypes.add_type('image/webp', '.webp'); mimetypes.add_type('font/woff2', '.woff2')
def data(p):
    p = (root / p).resolve(); m = mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
    return f'data:{m};base64,' + base64.b64encode(p.read_bytes()).decode()
def bundle(page, out):
    html = (root / page).read_text()
    html = re.sub(r'<link rel="preload"[^>]*>\n?', '', html)
    def css(m):
        f = root / m.group(1); txt = f.read_text()
        txt = re.sub(r"url\('\.\./([^']+)'\)", lambda u: f"url('{data(u.group(1))}')", txt)
        return '<style>' + txt + '</style>'
    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', css, html)
    html = re.sub(r'srcset="[^"]*"\s*', '', html)
    html = re.sub(r'src="(assets/[^"]+)"', lambda m: f'src="{data(m.group(1))}"', html)
    html = re.sub(r'href="(assets/[^"]+)"', lambda m: f'href="{data(m.group(1))}"', html)
    spk = {p.stem: data(p.relative_to(root)) for p in sorted((root / 'assets/speakers').glob('*.webp'))}
    extra = {'glass': data('assets/img/glass-1200.webp'), 'mark': data('assets/img/eig-mark.webp')}
    def js(m):
        txt = (root / m.group(1)).read_text()
        return '<script>' + txt.replace('</script', '<\\/script') + '</script>'
    html = re.sub(r'<script src="((?:js|data)/[^"]+|config\.js)"></script>', js, html)
    inline = dict(spk, __glass=extra['glass'], __mark=extra['mark'])
    html = html.replace('<body>', '<body><script>window.EIGOD_INLINE=' + json.dumps(inline) + ';</script>', 1)
    (root / '_screens' / out).write_text(html)
    print(out, round(len(html) / 1e6, 2), 'MB')
bundle('index.html', 'preview-sales.html')
bundle('watch.html', 'preview-watch.html')
