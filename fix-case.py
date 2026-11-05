# Membalik huruf besar/kecil token & secret di .env (kalau ketik saat Caps Lock nyala)
import re
p = '/opt/tro-system-bot/.env'
s = open(p).read()
def fix(m):
    v = m.group(2).strip()
    if m.group(1) == 'DISCORD_TOKEN' and v.startswith('MTU'):
        return m.group(0)  # sudah benar
    if m.group(1) == 'CLIENT_SECRET' and getattr(fix, 'skip', False):
        return m.group(0)
    return m.group(1) + '=' + v.swapcase()
tok = re.search(r'(?m)^DISCORD_TOKEN=(.*)$', s)
if tok and tok.group(1).strip().startswith('MTU'):
    print('Token sudah benar, tidak diubah.')
else:
    s = re.sub(r'(?m)^(DISCORD_TOKEN|CLIENT_SECRET)=(.*)$', fix, s)
    open(p, 'w').write(s)
    print('Token & secret sudah dibalik huruf besar/kecilnya.')
