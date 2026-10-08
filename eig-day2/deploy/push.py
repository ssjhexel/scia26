"""Push site/videos/<id>/ to the server through the one-time receiver (deploy/eigod-receive.php).
   python3 deploy/push.py https://consultingeig.com/wp-content/uploads/eig-ondemand/eigod-receive.php [ids]"""
import sys, hashlib, pathlib, urllib.request, urllib.parse, concurrent.futures as cf
ROOT = pathlib.Path(__file__).resolve().parent.parent
KEY = (ROOT / 'deploy' / '.key').read_text().strip()
URL = sys.argv[1]; IDS = sys.argv[2].split(',') if len(sys.argv) > 2 else None
def req(rel, data=None, sha=None):
    r = urllib.request.Request(URL + '?path=' + urllib.parse.quote(rel), data=data, method='POST' if data is not None else 'GET',
                               headers={'X-EIGOD-KEY': KEY, 'User-Agent': 'eigod-push/1', **({'X-EIGOD-SHA256': sha, 'Content-Type': 'application/octet-stream'} if sha else {})})
    with urllib.request.urlopen(r, timeout=120) as resp: return resp.read().decode()
def push(f):
    rel = 'videos/' + f.relative_to(ROOT / 'site' / 'videos').as_posix()
    b = f.read_bytes(); sha = hashlib.sha256(b).hexdigest()
    for attempt in range(5):
        try:
            if req(rel) == sha: return rel, 'skip', 0
            out = req(rel, b, sha)
            if out == 'ok': return rel, 'ok', len(b)
        except Exception as e: out = str(e)
    return rel, 'FAIL ' + out, 0
files = [f for f in sorted((ROOT / 'site' / 'videos').rglob('*')) if f.is_file() and (not IDS or f.relative_to(ROOT / 'site' / 'videos').parts[0] in IDS)]
# segments first, playlists last: a talk only appears once everything it references is there
files.sort(key=lambda f: (f.name.endswith('.m3u8'), f.name == 'master.m3u8', str(f)))
sent = 0; fails = []
with cf.ThreadPoolExecutor(4) as ex:
    for i, (rel, st, n) in enumerate(ex.map(push, files), 1):
        sent += n
        if st.startswith('FAIL'): fails.append((rel, st))
        if i % 200 == 0 or i == len(files): print(f'{i}/{len(files)} files, {sent / 1e6:.0f} MB sent', flush=True)
print('failures:', fails[:10] if fails else 'none')
