"""Synthetic program update checks; no financial fixtures or live installation."""
from pathlib import Path
import sys,tempfile,json,shutil,hashlib,os
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import apply_update as update
with tempfile.TemporaryDirectory() as td:
 root=Path(td);target=root/'Starter';target.mkdir();payload=root/'payload';payload.mkdir();data=root/'ExternalData';data.mkdir()
 for name in ['Start-App.bat','expense_book.py']:
  shutil.copy2(ROOT/'app'/name,target/name);shutil.copy2(ROOT/'app'/name,payload/name)
 (target/'expense_book.py').write_text((target/'expense_book.py').read_text().replace(json.loads((ROOT/'app/Source/package.json').read_text())['version'],'3.32.16-alpha.1'))
 (target/'web').mkdir();(target/'web/app.js').write_text('old bundle');(payload/'web').mkdir();(payload/'web/app.js').write_text('new bundle')
 names=['expense_book.py','web/app.js','Start-App.bat'];(payload/'PROGRAM-FILES.json').write_text(json.dumps(names))
 (target/'data-location.json').write_text(json.dumps({'path':str(data)}))
 workbook=data/'synthetic.xlsx';workbook.write_bytes(b'SYNTHETIC BYTES FOR UPDATE PRESERVATION')
 (data/'linked-workbooks.json').write_text(json.dumps({'years':{'2026':{'path':str(workbook)}},'preferences':{'title':'SYNTHETIC TITLE'}}))
 (data/'appearance-logo.png').write_bytes(b'SYNTHETIC IMAGE BYTES');(data/'inspection-history.json').write_text('{"jobs":[]}')
 preserved=[target/'data-location.json',*data.iterdir()];before={p:p.read_bytes() for p in preserved}
 backup=update.install(target,payload);assert (target/'web/app.js').read_text()=='new bundle'
 assert all(p.read_bytes()==b for p,b in before.items());manifest=json.loads((backup/'DATA-MANIFEST.json').read_text())
 assert len(manifest)==len(preserved)
 for item in manifest:assert hashlib.sha256((backup/item['copy']).read_bytes()).hexdigest()==item['sha256']
 # Simulated interrupted replacement rolls program files back; data stays identical.
 original=(target/'expense_book.py').read_bytes();(payload/'expense_book.py').write_bytes(original+b'\n# synthetic update\n');real_replace=update.os.replace
 def fail_second(src,dest):
  if Path(dest).name=='app.js':raise OSError('synthetic replacement failure')
  return real_replace(src,dest)
 try:
  with patch.object(update.os,'replace',fail_second):update.install(target,payload)
  raise AssertionError('replacement error ignored')
 except OSError:pass
 assert (target/'expense_book.py').read_bytes()==original;assert all(p.read_bytes()==b for p,b in before.items())
 (target/'expense_book.py').write_text('Expense Book 3.6.0')
 try:update.install(target,payload);raise AssertionError('production accepted')
 except ValueError as e:assert 'only for the experimental' in str(e)
 (target/'expense_book.py').write_bytes(original)
 if os.name!='nt':
  import fcntl
  with open(target/'app-instance.lock','a+b') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   try:update.install(target,payload);raise AssertionError('running app accepted')
   except ValueError as e:assert 'Exit Ctrl Ur Finances' in str(e)
 print('PASS updater: verified data backup, preserved external settings/logo/workbook, rollback on failure, live-version rejection and running-process lock.')
