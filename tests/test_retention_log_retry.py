"""Network-share log contention must preserve the ZIP and partial-removal accounting."""
import sys,tempfile,json,datetime as dt
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import backup_retention as br,recovery
class WrappedSaveError(Exception):pass
with tempfile.TemporaryDirectory() as td:
 root=Path(td)/'App';root.mkdir();p=root/'test.json';attempts=[]
 def transient(path,payload,backup=False):
  attempts.append(path)
  if len(attempts)<3:
   try:raise PermissionError(13,'Synthetic sharing lock')
   except OSError as exc:raise WrappedSaveError('Generic workbook message') from exc
  path.write_bytes(payload)
 with patch.object(br.time,'sleep'):
  br.save_metadata(SimpleNamespace(atomic_file=transient),p,{'ok':True})
 assert len(attempts)==3 and json.loads(p.read_text())['ok']
 # Other write failures do not get retried.
 attempts.clear()
 def disk_error(*a,**k):attempts.append(1);raise OSError(28,'Synthetic disk full')
 with patch.object(br.time,'sleep'):
  try:br.save_metadata(SimpleNamespace(atomic_file=disk_error),p,{});raise AssertionError('Error hidden')
  except br.MetadataWriteError:pass
 assert len(attempts)==1
 book=root/'Annual.xlsx';book.write_bytes(b'current workbook')
 cfg=root/'linked-workbooks.json';cfg.write_text(json.dumps({'years':{'2026':{'path':str(book)}}}))
 (root/'Start-App.bat').write_text('synthetic');(root/'expense_book.py').write_text('synthetic')
 app=SimpleNamespace(ROOT=root,DATA=root,CONFIG=cfg,load_config=lambda:json.loads(cfg.read_text()),resolve_path=Path,ensure_unlocked=lambda p:None,validate_xlsx=lambda b:None,__doc__='Expense Book 3.32.37')
 fail=[False];history_writes=[0]
 def atomic(path,payload,backup=False):
  if path.name==br.HISTORY:
   history_writes[0]+=1
   if fail[0] and history_writes[0]>1:
    try:raise PermissionError(13,'Synthetic log contention')
    except OSError as exc:raise WrappedSaveError('Generic workbook message') from exc
  path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(payload)
 app.atomic_file=atomic;recovery.counts=lambda p:{}
 folder=root/'Expense-Book-Backups'/'Annual';folder.mkdir(parents=True)
 for i in range(14):(folder/((dt.datetime.now()-dt.timedelta(days=500+i)).strftime('%Y%m%d-%H%M%S-%f')+'.xlsx')).write_bytes(b'old')
 br.configure(app,{'enabled':True,'reviewed':True});fail[0]=True
 with patch.object(br.time,'sleep'):result=recovery.create(app,{'destination':str(Path(td)/'ZIPs')})
 assert Path(result['path']).is_file() and result['cleanupSummary']['state']=='stopped'
 assert br.read(app)['history'][0]['state']=='stopped'
 assert result['cleanupSummary']['files']==1 and len(list(folder.iterdir()))==13
 assert 'cleanup history could not be updated' in result['cleanupWarning']
 record=json.loads((root/'backup-status.json').read_text());assert len(record['retentionRemoved'])==1
 assert recovery.status(app)['state']=='green'
 assert recovery.status(app,verify=False)['cleanupWarning']==result['cleanupWarning']
 # A new verified backup is allowed to resume a stopped run the same day.
 fail[0]=False
 result2=recovery.create(app,{'destination':str(Path(td)/'ZIPs')})
 assert result2['cleanupSummary']['state']=='complete' and len(list(folder.iterdir()))==10
 assert not result2.get('cleanupWarning')
 assert br.read(app)['history'][0]['files']==3
 assert book.read_bytes()==b'current workbook'
print('PASS bounded retries, nonsharing errors, persistent log failure, saved partial accounting/warning, verified ZIP and same-day stopped-run retry.')
