"""Store public account settings. Add the access token in macOS Keychain Access."""
import json
import re
from desk import STATE
uid = input('Instagram professional account ID: ').strip()
version = input('Meta application Graph API version (e.g. v25.0): ').strip()
if not uid.isdecimal() or not re.fullmatch(r'v[0-9]+\.[0-9]+',version):
    raise SystemExit('Invalid account ID or API version')
STATE.mkdir(exist_ok=True,parents=True,mode=0o700)
(STATE/'meta-config.json').write_text(json.dumps({'IG_USER_ID':uid,'IG_API_VERSION':version}))
