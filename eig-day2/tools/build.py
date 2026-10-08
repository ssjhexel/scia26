"""EIG Day 2 On-Demand: per-talk build. Turns the Studio Sound master into finished, streamable talks.

  python3 tools/build.py specs  [ids]   talk specs (timeline, overlays, chapters) -> work/specs/<id>.json
  python3 tools/build.py gfx    [ids]   render graphics for each spec            -> work/gfx/<id>/
  python3 tools/build.py render [ids]   master MP4                               -> work/out/<id>/<id>.mp4
  python3 tools/build.py hls    [ids]   HLS ladder, poster, captions             -> site/videos/<id>/
  python3 tools/build.py all    [ids]   all of the above, in order
  python3 tools/build.py data           write chapters + final durations into site/data/talks.js

Per talk, the body is the master between the trim points, minus editorial cuts. Presenter View frames are
cropped to the live slide; any stretch that isn't Presenter View (desktop, editor, email) shows the slide
the presenter was heading to, held still, while the audio carries on.
"""
import json, math, re, subprocess, sys, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORK = ROOT / 'work'; SITE = ROOT / 'site'
MASTER = WORK / 'master' / 'day2-master.mp4'
FPS = 25; FR = 1 / FPS
INTRO, OUTRO, XF = 8.0, 7.0, 0.6
LEAD = INTRO - XF                      # body starts here on the final timeline
CROP = 'crop=1226:689:25:151'          # live slide inside PowerPoint Presenter View (identical in every talk)
LT_DUR, CH_DUR = 6.0, 4.6

# talk id -> (start, end) in the master, from the Descript scenes
CUTS = {'09': (0, 1842.4), '10': (1842.4, 3484.6), '11': (3484.6, 5992.4), '12': (5992.4, 6527.8), '13': (6527.8, 6717.8),
        '14': (6717.8, 7062.8), '15': (7062.8, 7395.8), '16': (7395.8, 7895.6), '17': (7895.6, 9961.6),
        '18': (9961.6, 10295.3), '19': (10295.3, 11995.8)}
# editorial decisions layered on the transcript notes (talk-relative seconds)
EDIT = {
    '09': {},
    '10': {'out': 1620},                                   # desktop appears at 1621
    '15': {'lt_merge': [['joe-patti', 'adam-roth']]},     # introduced together: one shared lower third
    '17': {'cut': [[549.2, 577.6]], 'lt_first_only': True},   # attendee's remarks about his son's employer
    '18': {'out': 311.5},
    # Labs recap is off-record: keep Mark's invitation and the closing reflections only
    '19': {'in': 57.8, 'out': 1324.6, 'cut': [[88.1, 1117.8]],
           'lt_add': [{'t': 1124, 'id': 'jim-de-vries'}],
           'chapters': [{'t': 57.8, 'title': 'Inviting the report-outs'}, {'t': 1117.8, 'title': 'Thanks and reflections'}]},
}

def q(p): return str(p)
def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode: sys.exit('FAILED: ' + ' '.join(map(str, cmd))[:400] + '\n' + r.stderr[-3000:])
    return r
def snap(t): return round(t * FPS) / FPS
def talks_js():
    out = run(['node', '-e', "global.window={}; require(process.argv[1]); console.log(JSON.stringify({s: window.EIG_SPEAKERS, t: window.EIG_TALKS}))", q(SITE / 'data/talks.js')]).stdout
    return json.loads(out)

def load_edit(tid):
    e = dict(EDIT.get(tid, {}))
    f = WORK / 'edit' / f'{tid}.json'   # optional overrides written after review
    if f.exists(): e.update(json.load(open(f)))
    return e

# ------------------------------------------------------------------------------------------- specs
def build_spec(tid, T, S):
    import numpy as np
    order = [t['id'] for t in T]; i = order.index(tid); talk = T[i]
    notes = json.load(open(WORK / 'transcript' / f'notes-{tid}.json'))
    ed = load_edit(tid)
    a, b = CUTS[tid]
    tin = ed.get('in', notes['trim']['in']); tout = min(ed.get('out', notes['trim']['out']), b - a)
    cuts = sorted(ed.get('cut', []))
    # kept intervals (talk-relative), snapped to frames
    keep, cur = [], tin
    for s, e in cuts:
        if e <= cur or s >= tout: continue
        if s > cur: keep.append([cur, s])
        cur = max(cur, e)
    if cur < tout: keep.append([cur, tout])
    keep = [[snap(s), snap(e)] for s, e in keep if e - s > .2]

    # Presenter View mask (1 s resolution), widened by 1 s so nothing off-slide can slip through
    d = np.load(WORK / 'scan.npz'); pv = (d['sm'] < 45) & (d['ss'] < 33) & (d['top'] < 45)
    bad = ~pv; bad = bad | np.roll(bad, 1) | np.roll(bad, -1)
    def is_pv(t): k = int(a + t); return 0 <= k < len(pv) and not bad[k]
    def next_pv(t, lim):
        x = math.ceil(t)
        while x < lim:
            if is_pv(x) and is_pv(x + 1): return x + .5
            x += 1
        return None
    def prev_pv(t):
        x = math.floor(t) - 1
        while x > 0:
            if is_pv(x): return x + .5
            x -= 1
        return None

    segs = []   # {s, e (talk-relative), mode: pv|hold, hold: talk-relative time of frame}
    for s, e in keep:
        t = s
        while t < e:
            mode = 'pv' if is_pv(t) else 'hold'
            u = t
            while u < e and (is_pv(u) if mode == 'pv' else not is_pv(u)):
                u = min(e, math.floor(u) + 1)
            seg = {'s': snap(t), 'e': snap(u), 'mode': mode}
            if mode == 'hold':
                h = next_pv(u, b - a) or prev_pv(t)
                seg['hold'] = h
            if seg['e'] - seg['s'] >= FR: segs.append(seg)
            t = u
    # merge neighbours of the same kind (and same hold frame)
    m = []
    for sg in segs:
        if m and m[-1]['mode'] == sg['mode'] and m[-1].get('hold') == sg.get('hold') and abs(m[-1]['e'] - sg['s']) < 1e-6: m[-1]['e'] = sg['e']
        else: m.append(sg)
    segs = m
    body = sum(sg['e'] - sg['s'] for sg in segs)

    def to_body(t):
        acc = 0
        for s, e in keep:
            if t < s: return acc
            if t <= e: return acc + (t - s)
            acc += e - s
        return acc

    def person(pid, note=None):
        p = S.get(pid, {'name': pid, 'role': ''})
        n = note or next((x.get('note') for x in talk['speakers'] if x['id'] == pid), None)
        return {'id': pid, 'name': p['name'], 'role': p['role'], **({'note': n} if n else {})}

    # lower thirds
    lts, seen = [], set()
    for l in sorted(notes['lowerThirds'] + ed.get('lt_add', []), key=lambda x: x['t']):
        if l['id'] in ed.get('drop_lt', []): continue
        if ed.get('lt_first_only') and l['id'] in seen: continue
        seen.add(l['id'])
        if not any(s0 - 1 <= l['t'] <= e0 for s0, e0 in keep): continue
        tb = to_body(l['t'])
        if tb < 0 or tb > body - LT_DUR - 1: continue
        lts.append({'t': round(max(tb, 1.2), 2), **person(l['id'])})
    for grp in ed.get('lt_merge', []):
        hit = [x for x in lts if x['id'] in grp]
        if hit:
            t0 = min(x['t'] for x in hit); lts = [x for x in lts if x['id'] not in grp]
            ppl = [person(g) for g in grp]
            role = ppl[0]['role'] if len({p['role'] for p in ppl}) == 1 else ' · '.join(p['role'] for p in ppl)
            role = role.replace('Co-Founder & Principal', 'Co-Founders & Principals') if len(ppl) > 1 else role
            lts.append({'t': t0, 'id': grp[0], 'ids': grp, 'name': ' & '.join(p['name'] for p in ppl), 'role': role})
    lts.sort(key=lambda x: x['t'])
    # drop lower thirds that would overlap the previous one
    keep_lt = []
    for l in lts:
        if keep_lt and l['t'] < keep_lt[-1]['t'] + LT_DUR + .5: continue
        keep_lt.append(l)
    lts = keep_lt

    # chapters: on the final timeline for the player; cards on the body timeline
    chs = [c for c in ed.get('chapters', notes['chapters']) if tin - 2 <= c['t'] <= tout - 20 and any(s0 - 2 <= c['t'] <= e0 for s0, e0 in keep)]
    chapters, cards = [], []
    for n, c in enumerate(chs, 1):
        tb = max(0.0, to_body(c['t']))
        chapters.append({'t': 0 if n == 1 else round(LEAD + tb, 1), 'title': c['title']})
        if n == 1: continue
        t0 = tb
        for l in lts:   # don't stack a chapter card on a lower third
            if l['t'] - CH_DUR - .4 < t0 < l['t'] + LT_DUR + .4: t0 = l['t'] + LT_DUR + .5
        if t0 - tb > 9 or t0 > body - CH_DUR - 1: continue
        cards.append({'t': round(t0, 2), 'n': n, 'of': len(chs), 'title': c['title']})

    nxt = T[i + 1] if i + 1 < len(T) else None
    spec = {
        'id': tid, 'num': f'{i + 1:02d}', 'of': len(T), 'track': talk['track'], 'title': talk['title'],
        'speakers': [person(s['id'], s.get('note')) for s in talk['speakers']],
        'next': {'num': f'{i + 2:02d}', 'title': nxt['title'], 'speakers': [S[s['id']]['name'] for s in nxt['speakers'] if s.get('note') != 'Chair'] or [S[s['id']]['name'] for s in nxt['speakers']]} if nxt else None,
        'master': [a, b], 'keep': keep, 'segs': segs, 'body': round(body, 3),
        'final': round(INTRO + body + OUTRO - 2 * XF, 3),
        'lts': lts, 'chapters': cards, 'playerChapters': chapters,
    }
    (WORK / 'specs').mkdir(parents=True, exist_ok=True)
    json.dump(spec, open(WORK / 'specs' / f'{tid}.json', 'w'), indent=1, ensure_ascii=False)
    holds = sum(sg['e'] - sg['s'] for sg in segs if sg['mode'] == 'hold')
    print(f"{tid}: body {body/60:.1f} min, final {spec['final']/60:.1f} min, {len(segs)} segs ({holds:.0f}s held), {len(lts)} LTs, {len(cards)} cards")
    return spec

# --------------------------------------------------------------------------------------------- gfx
def gfx(tid):
    out = WORK / 'gfx' / tid
    run(['node', q(ROOT / 'motion/render.mjs'), 'talk', q(WORK / 'specs' / f'{tid}.json'), q(out)])
    common = WORK / 'gfx' / 'common'
    if not (common / 'intro.wav').exists():
        common.mkdir(parents=True, exist_ok=True); run(['python3', q(ROOT / 'motion/sting.py'), q(common)])
    print(tid, 'gfx ok')

# ------------------------------------------------------------------------------------------ render
def graph(spec, measured=None):
    """inputs + filter_complex for the body (video and audio)"""
    a = spec['master'][0]; ins, fv, fa, n = [], [], [], 0
    gdir = WORK / 'gfx' / spec['id']
    for k, sg in enumerate(spec['segs']):
        st, du = a + sg['s'], sg['e'] - sg['s']
        ins += ['-ss', f'{st:.3f}', '-t', f'{du:.3f}', '-i', q(MASTER)]; ai = n; n += 1
        if sg['mode'] == 'pv':
            fv.append(f'[{ai}:v]{CROP},scale=1920:1080:flags=lanczos,unsharp=5:5:0.4:3:3:0,setsar=1,fps={FPS},format=yuv420p,setpts=PTS-STARTPTS[v{k}]')
        else:
            png = gdir / f"hold-{sg['hold']:.1f}.png"
            if not png.exists():
                run(['ffmpeg', '-v', 'error', '-y', '-ss', f"{a + sg['hold']:.3f}", '-i', q(MASTER), '-frames:v', '1', q(png)])
            ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{du:.3f}', '-i', q(png)]; hi = n; n += 1
            fv.append(f'[{hi}:v]{CROP},scale=1920:1080:flags=lanczos,unsharp=5:5:0.4:3:3:0,setsar=1,fps={FPS},format=yuv420p,setpts=PTS-STARTPTS[v{k}]')
        fade = ''
        if any(abs(sg['s'] - kp[0]) < 1e-6 for kp in spec['keep']): fade += ',afade=t=in:d=0.015'
        if any(abs(sg['e'] - kp[1]) < 1e-6 for kp in spec['keep']): fade += f",afade=t=out:st={max(0, du - 0.015):.3f}:d=0.015"
        fa.append(f'[{ai}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS{fade}[a{k}]')
    K = len(spec['segs'])
    cat = ''.join(f'[v{k}][a{k}]' for k in range(K)) + f'concat=n={K}:v=1:a=1[bv][ba]'
    ln = 'loudnorm=I=-16:TP=-1.5:LRA=11'
    if measured:
        ln += (f":measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:measured_LRA={measured['input_lra']}"
               f":measured_thresh={measured['input_thresh']}:offset={measured['target_offset']}:linear=true")
    return ins, n, fv, fa, cat, ln

def measure(spec):
    ins, n, fv, fa, cat, ln = graph(spec)
    # audio-only pass: feed silence-free concat of the audio branches
    K = len(spec['segs'])
    ains = []
    for k, sg in enumerate(spec['segs']):
        ains += ['-ss', f"{spec['master'][0] + sg['s']:.3f}", '-t', f"{sg['e'] - sg['s']:.3f}", '-vn', '-i', q(MASTER)]
    f = ';'.join(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a{k}]' for k in range(K))
    f += ';' + ''.join(f'[a{k}]' for k in range(K)) + f'concat=n={K}:v=0:a=1,{ln}:print_format=json[o]'
    r = run(['ffmpeg', '-hide_banner', '-nostats', *ains, '-filter_complex', f, '-map', '[o]', '-f', 'null', '-'])
    js = r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1]
    return json.loads(js)

def render(tid, preset='faster'):
    spec = json.load(open(WORK / 'specs' / f'{tid}.json'))
    gdir = WORK / 'gfx' / tid; common = WORK / 'gfx' / 'common'
    m = measure(spec)
    print(tid, 'loudness in', m['input_i'], 'LUFS, peak', m['input_tp'])
    ins, n, fv, fa, cat, ln = graph(spec, m)
    body = spec['body']
    # overlays
    ov = []
    for i, l in enumerate(spec['lts']): ov.append((gdir / f'lt-{i}.mov', l['t']))
    for i, c in enumerate(spec['chapters']): ov.append((gdir / f'ch-{i}.mov', c['t']))
    chain, last = [], 'bv'
    for j, (f, t) in enumerate(ov):
        ins += ['-i', q(f)]; idx = n; n += 1
        chain.append(f'[{idx}:v]format=yuva420p,setpts=PTS-STARTPTS+{t:.3f}/TB[o{j}]')
        chain.append(f'[{last}][o{j}]overlay=0:680:eof_action=pass:format=auto[b{j}]'); last = f'b{j}'
    ins += ['-i', q(gdir / 'intro.mp4')]; ii = n; n += 1
    ins += ['-i', q(gdir / 'outro.mp4')]; oi = n; n += 1
    ins += ['-i', q(common / 'intro.wav')]; iw = n; n += 1
    ins += ['-i', q(common / 'outro.wav')]; ow = n; n += 1
    off2 = LEAD + body - XF
    vid = [f'[{last}]format=yuv420p,settb=AVTB,fps={FPS}[bodyv]',
           f'[{ii}:v]format=yuv420p,settb=AVTB,fps={FPS},setsar=1[iv]', f'[{oi}:v]format=yuv420p,settb=AVTB,fps={FPS},setsar=1[ov]',
           f'[iv][bodyv]xfade=transition=fade:duration={XF}:offset={LEAD:.3f}[x1]',
           f'[x1][ov]xfade=transition=fade:duration={XF}:offset={off2:.3f},format=yuv420p[vout]']
    aud = [f'[ba]{ln},aresample=48000,afade=t=in:d={XF},afade=t=out:st={body - 1.0:.3f}:d=1.0,adelay={int(LEAD * 1000)}:all=1[bodya]',
           f'[{iw}:a]aresample=48000[ia]', f'[{ow}:a]aresample=48000,adelay={int(off2 * 1000)}:all=1[oa]',
           f'[ia][bodya][oa]amix=inputs=3:normalize=0:duration=longest,atrim=0:{spec["final"]:.3f},alimiter=limit=0.89:level=false[aout]']
    fc = ';'.join(fv + fa + [cat] + chain + vid + aud)
    out = WORK / 'out' / tid; out.mkdir(parents=True, exist_ok=True)
    (out / 'filter.txt').write_text(fc.replace(';', ';\n'))
    mp4 = out / f'{tid}.mp4'
    cmd = ['ffmpeg', '-v', 'error', '-stats_period', '30', '-y', *ins, '-filter_complex_script', q(out / 'filter.txt'),
           '-map', '[vout]', '-map', '[aout]',
           '-c:v', 'libx264', '-preset', preset, '-crf', '19', '-maxrate', '4M', '-bufsize', '8M', '-profile:v', 'high', '-level', '4.1',
           '-g', str(FPS * 4), '-keyint_min', str(FPS * 4), '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', '-t', f"{spec['final']:.3f}", q(mp4)]
    run(cmd)
    d = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', q(mp4)]).stdout)
    print(tid, 'rendered', mp4.name, f'{d:.2f}s (spec {spec["final"]:.2f}s)', f'{mp4.stat().st_size / 1e6:.0f} MB')

# --------------------------------------------------------------------------------------------- hls
LADDER = [('1080p', None, None, '160k'), ('720p', 1280, ('21', '1800k'), '128k'), ('480p', 854, ('22', '900k'), '96k')]
def hls(tid):
    spec = json.load(open(WORK / 'specs' / f'{tid}.json'))
    mp4 = WORK / 'out' / tid / f'{tid}.mp4'
    dst = SITE / 'videos' / tid
    if dst.exists(): shutil.rmtree(dst)
    dst.mkdir(parents=True)
    variants = []
    for name, w, rc, ab in LADDER:
        (dst / name).mkdir()
        if w is None: enc = ['-c', 'copy']
        else:
            h = 720 if w == 1280 else 480
            enc = ['-vf', f'scale={w}:{h}:flags=lanczos', '-c:v', 'libx264', '-preset', 'faster', '-crf', rc[0], '-maxrate', rc[1],
                   '-bufsize', str(int(rc[1][:-1]) * 2) + 'k', '-profile:v', 'high', '-level', '3.1' if w == 1280 else '3.0',
                   '-g', str(FPS * 4), '-keyint_min', str(FPS * 4), '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
                   '-c:a', 'aac', '-b:a', ab, '-ar', '48000']
        run(['ffmpeg', '-v', 'error', '-y', '-i', q(mp4), *enc, '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod',
             '-hls_segment_filename', q(dst / name / 's%04d.ts'), q(dst / name / 'index.m3u8')])
        # bandwidth from segment sizes
        pl = (dst / name / 'index.m3u8').read_text()
        durs = [float(x) for x in re.findall(r'#EXTINF:([\d.]+)', pl)]; files = re.findall(r'^(s\d+\.ts)$', pl, re.M)
        rates = [(dst / name / f).stat().st_size * 8 / d for f, d in zip(files, durs) if d > .5]
        tot = sum((dst / name / f).stat().st_size for f in files) * 8 / sum(durs)
        pr = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=profile,level,width,height', '-of', 'json', q(dst / name / files[0])]).stdout
        st = json.loads(pr)['streams'][0]
        codec = 'avc1.%02x%02x%02x,mp4a.40.2' % ({'High': 100, 'Main': 77, 'Constrained Baseline': 66}.get(st['profile'], 100), 0, st['level'])
        variants.append((name, int(max(rates) * 1.05), int(tot), st['width'], st['height'], codec))
    m = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS']
    for name, peak, avg, w, h, codec in variants:
        m += [f'#EXT-X-STREAM-INF:BANDWIDTH={peak},AVERAGE-BANDWIDTH={avg},RESOLUTION={w}x{h},FRAME-RATE={FPS}.000,CODECS="{codec}"', f'{name}/index.m3u8']
    (dst / 'master.m3u8').write_text('\n'.join(m) + '\n')
    run(['ffmpeg', '-v', 'error', '-y', '-ss', '5.6', '-i', q(WORK / 'gfx' / tid / 'intro.mp4'), '-frames:v', '1', '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '3', q(dst / 'poster.jpg')])
    captions(spec, dst / 'captions.vtt')
    size = sum(f.stat().st_size for f in dst.rglob('*') if f.is_file())
    print(tid, 'hls', ', '.join(f'{v[0]} avg {v[2] / 1e6:.2f} Mbps' for v in variants), f'| folder {size / 1e6:.0f} MB')

# ------------------------------------------------------------------------------------------ captions
FIX = [(r'\bJose Perez\b', 'Jose Pires'), (r'\bJosé Pérez\b', 'Jose Pires'), (r'\b(Chainside|Chainsight|Change Side|Chain Site|chain site|Chain Sight) ?[AI]Q\b', 'ChainSightAQ'),
       (r'\bChainSight IQ\b', 'ChainSightAQ'), (r'\bAgile Extended\b', 'AgileXtended'), (r'\bLayla\b', 'Leila'), (r'\bEnroot\b', 'inRoot'),
       (r'\bEric Herman\b', 'Erik Herman'), (r'\bA\.E\. Herman\b', 'AE Herman'), (r'\b(Hosny|Kosni)\b', 'Hosni'), (r'\bBoolan\b', 'Bulent'), (r'\bNitten\b', 'Nitin'),
       (r'\bsecurity mixologists\b', 'Security Mixologists'), (r'\bdefense industry baseline\b', 'Defense Industrial Base'),
       (r'\bConnor model\b', 'Kano model'), (r'\bTrust Accelerator [Ii]ndex\b', 'Trust Acceleration Index'), (r'\bMain and Core\b', 'Core & Main'),
       (r'\bEnhanced International Group\b', 'Enhance International Group'), (r'\bThanks, Elena\b', 'Thanks, Leila')]
def srt_cues():
    txt = (WORK / 'transcript' / 'all-talks.srt').read_text()
    cues = []
    for blk in re.split(r'\n\s*\n', txt.strip()):
        ls = blk.strip().splitlines()
        if len(ls) < 3: continue
        m = re.match(r'(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)', ls[1])
        if not m: continue
        g = list(map(int, m.groups()))
        cues.append((g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000, g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000, ' '.join(ls[2:])))
    return cues
def clean(t):
    t = re.sub(r'\b([Uu]m+|[Uu]h+|[Ee]r+m?)\b[,.]?\s*', '', t)
    t = re.sub(r'\s*\.\.\.\s*', '… ', t); t = re.sub(r'\s+', ' ', t).strip()
    for a, b in FIX: t = re.sub(a, b, t)
    if t: t = t[0].upper() + t[1:]
    return t
def wrap(t, w=42):
    words, lines, cur = t.split(), [], ''
    for x in words:
        if len(cur) + len(x) + 1 > w and cur: lines.append(cur); cur = x
        else: cur = (cur + ' ' + x).strip()
    if cur: lines.append(cur)
    if len(lines) > 2: lines = [' '.join(lines[:len(lines) // 2]), ' '.join(lines[len(lines) // 2:])]
    return '\n'.join(lines)
def captions(spec, path):
    a = spec['master'][0]; out = ['WEBVTT', '']
    def stamp(x): h, r = divmod(x, 3600); m, s = divmod(r, 60); return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'
    acc = 0.0; n = 0
    for s, e in spec['keep']:
        for cs, ce, txt in srt_cues():
            cs -= a; ce -= a
            if ce <= s or cs >= e: continue
            t = clean(txt)
            if not t: continue
            fs = LEAD + acc + max(cs, s) - s; fe = LEAD + acc + min(ce, e) - s
            if fe - fs < .3: continue
            n += 1; out += [str(n), f'{stamp(fs)} --> {stamp(fe)}', wrap(t), '']
        acc += e - s
    path.write_text('\n'.join(out))

# -------------------------------------------------------------------------------------------- data
def write_data():
    p = SITE / 'data' / 'talks.js'; s = p.read_text()
    for f in sorted((WORK / 'specs').glob('*.json')):
        sp = json.load(open(f)); tid = sp['id']
        i0 = s.index(f"id: '{tid}'"); i1 = s.index('video:', i0)
        blk = s[i0:i1]
        blk = re.sub(r'durationSec: [\d.]+', f"durationSec: {sp['final']:.1f}", blk, 1)
        ch = ', '.join("{ t: %s, title: '%s' }" % (c['t'], c['title'].replace("'", "\\'")) for c in sp['playerChapters'])
        blk = re.sub(r'chapters: \[[^\]]*\]', f'chapters: [{ch}]', blk, 1)
        s = s[:i0] + blk + s[i1:]
        # captions next to the stream once it exists
        j = s.index('video:', s.index(f"id: '{tid}'"))
        k = s.index('}', j)
        if (SITE / 'videos' / tid / 'captions.vtt').exists() and 'captions' not in s[j:k]:
            s = s[:k] + f", captions: '{tid}/captions.vtt' " + s[k:]
    p.write_text(s)
    print('talks.js updated')

if __name__ == '__main__':
    cmd = sys.argv[1]; ids = sys.argv[2].split(',') if len(sys.argv) > 2 else sorted(CUTS)
    if cmd == 'data': write_data(); sys.exit()
    D = talks_js(); T, S = D['t'], D['s']
    for tid in ids:
        if cmd in ('specs', 'all'): build_spec(tid, T, S)
        if cmd in ('gfx', 'all'): gfx(tid)
        if cmd in ('render', 'all'): render(tid)
        if cmd in ('hls', 'all'): hls(tid)
