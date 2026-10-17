"""Browser PNG ancillary metadata should not prevent saving a valid logo."""
from pathlib import Path
import sys,base64,struct,zlib
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import preferences,expense_book as app
def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
head=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,6,0,0,0))
tail=chunk(b'IDAT',zlib.compress(b'\x00\x32\x66\x99\xff'))+chunk(b'IEND',b'')
def check(raw):return preferences.logo_bytes(app,base64.b64encode(raw).decode())
plain=head+tail
for kind,payload in [(b'tEXt',b'Software\x00Browser'),(b'iTXt',b'Comment\x00\x00\x00\x00\x00Test'),(b'eXIf',b'Synthetic optional metadata'),(b'vpAg',b'\x00'*9)]:
 assert check(head+chunk(kind,payload)+tail)==plain
profile=chunk(b'iCCP',b'Profile\x00\x00'+zlib.compress(b'Synthetic profile validation fixture'))
assert check(head+profile+tail)==head+profile+tail
for bad in [head+chunk(b'ABCD',b'critical')+tail,head+chunk(b'tEXt',b'bad crc')[:-1]+b'\x00'+tail,plain+b'extra',head+tail[:-12]+chunk(b'IEND',b'invalid')]:
 try:check(bad);raise AssertionError('Invalid PNG accepted')
 except app.UserError:pass
assert check(plain)==plain
print('PASS logo metadata: ancillary metadata stripped, color profile retained, malformed/unknown-critical chunks rejected.')
