"""Build the gating kit: the files that go on the server to switch on purchase-gating and the partner link.

  python3 tools/make-gating-kit.py        ->  deploy/gating-kit/   (git-ignored: it holds your secrets)

The first run makes a random signing secret and partner key and writes them into eigod-config.php; later runs reuse
them (so partner links already sent keep working). Delete deploy/gating-kit/eigod-config.php to start over.
"""
import re, secrets, shutil, zipfile, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
WP = ROOT / 'site' / 'wordpress'; KIT = ROOT / 'deploy' / 'gating-kit'
SITE = 'https://consultingeig.com/austinondemand/watch/'

KIT.mkdir(parents=True, exist_ok=True)
cfg = KIT / 'eigod-config.php'
if cfg.exists():
    txt = cfg.read_text()
else:
    txt = (WP / 'eigod-config.php.example').read_text().replace('{SECRET}', secrets.token_hex(24)).replace('{PARTNER_KEY}', secrets.token_hex(16))
    cfg.write_text(txt)
partner_key = re.search(r"'partner_key' => '([^']*)'", txt).group(1)

# 1) the zip: extract it in the home folder (the one that contains public_html) and every file lands in place
with zipfile.ZipFile(KIT / 'eigod-gating-kit.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(cfg, 'eigod-config.php')
    z.write(WP / 'videos-gate.php.example', 'public_html/eigod-gate.php')
    z.write(WP / 'eigod-access.php.example', 'public_html/wp-content/mu-plugins/eigod-access.php')
# 2) loose copies of the other files
shutil.copy(WP / 'videos.htaccess.example', KIT / 'videos-htaccess.txt')
for t in ('eig-day2-on-demand.php', 'eig-day2-on-demand-watch.php'): shutil.copy(WP / 'templates' / t, KIT / t)
shutil.copy(WP / 'READ-ME-FIRST.txt', KIT / 'READ-ME-FIRST.txt')
(KIT / 'partner-link.txt').write_text(f'{SITE}?partner={partner_key}\n')
print('kit written to', KIT); print('partner link:', f'{SITE}?partner={partner_key}')
