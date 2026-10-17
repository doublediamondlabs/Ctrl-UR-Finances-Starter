"""Regression: selected logos use blob URLs; only image policy must permit them."""
from pathlib import Path
import tempfile,shutil,subprocess,sys,re,urllib.request,time
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as td:
 target=Path(td)/'app';shutil.copytree(ROOT/'app',target,ignore=shutil.ignore_patterns('node_modules','__pycache__'))
 log=open(Path(td)/'server.log','w+')
 proc=subprocess.Popen([sys.executable,'-u',str(target/'expense_book.py'),'--no-browser'],stdout=log,stderr=log)
 try:
  url=None
  for _ in range(100):
   log.seek(0);out=log.read();match=re.search(r'http://127\.0\.0\.1:\d+/',out)
   if match:url=match.group();break
   if proc.poll() is not None:raise AssertionError(out)
   time.sleep(.05)
  assert url,'Server did not start'
  with urllib.request.urlopen(url) as response:
   policy=response.headers['Content-Security-Policy'];body=response.read()
  directives={parts[0]:parts[1:] for d in policy.split(';') if (parts:=d.strip().split())}
  assert directives['img-src']==["'self'",'data:','blob:'],policy
  assert directives['script-src']==["'self'"]
  assert directives['connect-src']==["'self'"]
  assert b'__APP_TOKEN__' not in body
  print('PASS served logo policy: local blob images allowed; script and connection restrictions unchanged.')
 finally:
  proc.terminate();proc.wait(timeout=5);log.close()
