"""Push finished talks to the server through the one-time receiver (deploy/eigod-receive.php, in the site root).
   python3 deploy/push.py https://consultingeig.com/eigod-receive.php 12,14   (ids optional: default all ready)
Streams go to uploads/eig-ondemand/videos/<id>/, the MP4 master to uploads/eig-ondemand/masters/<id>.mp4.
Re-running is safe: files already on the server with the same checksum are skipped; big files resume."""
import sys, hashlib, pathlib, urllib.request, urllib.parse, urllib.error, concurrent.futures as cf, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
KEY = (ROOT / 'deploy' / '.key').read_text().strip()
URL = sys.argv[1]; IDS = sys.argv[2].split(',') if len(sys.argv) > 2 else None
CHUNK = 4 * 1024 * 1024
def req(rel, data=None, **q):
    qs = urllib.parse.urlencode({'path': rel, **q})
    r = urllib.request.Request(URL + '?' + qs, data=data, method='POST' if (data is not None or q) else 'GET',
                               headers={'X-EIGOD-KEY': KEY, 'User-Agent': 'eigod-push/2', 'Content-Type': 'application/octet-stream'})
    try:
        with urllib.request.urlopen(r, timeout=180) as resp: return resp.read().decode()
    except urllib.error.HTTPError as e: return f'HTTP {e.code} ' + e.read().decode()[:80]
def sha_of(f):
    h = hashlib.sha256()
    with open(f, 'rb') as fh:
        for b in iter(lambda: fh.read(1 << 20), b''): h.update(b)
    return h.hexdigest()
def push(item):
    f, rel = item; sha = sha_of(f); size = f.stat().st_size
    for attempt in range(6):
        try:
            st = req(rel)
            if st == sha: return rel, 'skip', 0
            off = int(st.split(':')[1]) if st.startswith('partial:') and size > CHUNK else 0
            with open(f, 'rb') as fh:
                fh.seek(off)
                while True:
                    b = fh.read(CHUNK)
                    last = fh.tell() >= size
                    out = req(rel, b, offset=off, **({'commit': sha} if last else {}))
                    if last:
                        if out == 'ok': return rel, 'ok', size
                        raise RuntimeError(out)
                    if not out.startswith('ok:'): raise RuntimeError(out)
                    off += len(b)
        except Exception as e:
            err = str(e); time.sleep(2 * (attempt + 1))
    return rel, 'FAIL ' + err, 0
vids = ROOT / 'site' / 'videos'
ready = sorted(d.name for d in vids.iterdir() if (d / 'master.m3u8').exists()) if vids.exists() else []
ids = [i for i in (IDS or ready) if i in ready]
items = []
for i in ids:
    items += [(f, 'videos/' + f.relative_to(vids).as_posix()) for f in sorted((vids / i).rglob('*')) if f.is_file()]
    mp4 = ROOT / 'work' / 'out' / i / f'{i}.mp4'
    if mp4.exists(): items.append((mp4, f'masters/{i}.mp4'))
# segments first, playlists last (a talk only plays once everything it references is there), masters at the end
items.sort(key=lambda x: (x[1].startswith('masters/'), x[1].endswith('.m3u8'), x[1].endswith('master.m3u8'), x[1]))
print('pushing talks', ids, len(items), 'files', flush=True)
sent = 0; fails = []
with cf.ThreadPoolExecutor(4) as ex:
    for k, (rel, st, n) in enumerate(ex.map(push, items), 1):
        sent += n
        if st.startswith('FAIL'): fails.append((rel, st))
        if k % 250 == 0 or k == len(items): print(f'{k}/{len(items)} files, {sent / 1e6:.0f} MB sent', flush=True)
print('failures:', fails[:10] if fails else 'none')
