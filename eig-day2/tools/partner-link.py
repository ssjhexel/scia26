"""Make private partner links (free access to the Day 2 On-Demand library, no purchase).

  EIGOD_SECRET='the string inside eigod-secret.php' python3 tools/partner-link.py "Erik Rodriguez" "Ezra Firewalker"
  ... --base https://consultingeig.com/austinondemand/watch/      (default)

Each link is signed with the shared secret, so it can't be guessed or edited. It carries the partner's name
(as a slug, e.g. erik-rodriguez); to revoke one, add that slug to EIGOD_REVOKED_PARTNERS in wp-config.php.
Anyone holding a link gets in, so send each partner their own and don't post them publicly.
"""
import os, re, sys, hmac, hashlib, base64, argparse

ap = argparse.ArgumentParser()
ap.add_argument('names', nargs='+')
ap.add_argument('--base', default='https://consultingeig.com/austinondemand/watch/')
a = ap.parse_args()
secret = os.environ.get('EIGOD_SECRET', '')
if not secret: sys.exit('Set EIGOD_SECRET to the string inside eigod-secret.php (the same one the site uses).')
for name in a.names:
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:40]
    payload = base64.urlsafe_b64encode(slug.encode()).decode().rstrip('=')
    sig = hmac.new(secret.encode(), ('p' + payload).encode(), hashlib.sha256).hexdigest()
    print(f'{name:<24} {slug:<24} {a.base}?partner={payload}.{sig}')
