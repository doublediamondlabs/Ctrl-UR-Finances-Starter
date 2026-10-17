"""Starter retention must follow DATA while program archives remain under ROOT."""
from pathlib import Path
import sys,tempfile,json,datetime as dt
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import backup_retention as br,recovery
with tempfile.TemporaryDirectory() as td:
 root=Path(td)/'App';data=Path(td)/'ExternalData';root.mkdir();data.mkdir()
 book=data/'Annual.xlsx';book.write_bytes(b'synthetic workbook')
 cfg=data/'linked-workbooks.json';cfg.write_text(json.dumps({'years':{'2026':{'path':str(book)}}}))
 (root/'data-location.json').write_text(json.dumps({'path':str(data)}))
 (root/'Start-App.bat').write_text('synthetic');(root/'expense_book.py').write_text('synthetic')
 app=SimpleNamespace(ROOT=root,DATA=data,CONFIG=cfg,load_config=lambda:json.loads(cfg.read_text()),resolve_path=Path,ensure_unlocked=lambda p:None,validate_xlsx=lambda b:None,__doc__='Expense Book 3.32.36-alpha.1')
 def atomic(p,b,backup=False):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 app.atomic_file=atomic;recovery.counts=lambda p:{}
 histories=[data/'Expense-Book-Backups'/'Annual',data/'Loan-Tracker-Backups',data/'Inspection-History-Backups',root/'App-Update-Backups']
 for p in histories:p.mkdir(parents=True)
 for i in range(12):
  stamp=(dt.datetime.now()-dt.timedelta(days=500+i)).strftime('%Y%m%d-%H%M%S-%f')
  (histories[0]/(stamp+'.xlsx')).write_bytes(b'old workbook')
  (histories[1]/(stamp+'.json')).write_text('{}')
  p=histories[2]/stamp;p.mkdir();(p/'0-Annual.xlsx').write_bytes(b'old workbook')
  p=histories[3]/('before-starter-update-'+stamp);p.mkdir();(p/'PROGRAM-MANIFEST.json').write_text('{}');(p/'DATA-MANIFEST.json').write_text('[]')
 legacy=histories[3]/'before-starter-update-20200101-120000-000000';legacy.mkdir();(legacy/'DATA-MANIFEST.json').write_text('[]')
 assert len(br.preview(app)['folders'])==4
 br.configure(app,{'enabled':True,'reviewed':True});assert (data/br.SETTINGS).exists() and not (root/br.SETTINGS).exists()
 (data/'inspection-transaction.json').write_text('{}');assert br.preview(app)['blocked'];(data/'inspection-transaction.json').unlink()
 before=book.read_bytes();result=recovery.create(app,{});assert result['state']=='green',result
 assert all(len(list(p.iterdir()))==10 for p in histories[:3])
 assert len(list(histories[3].iterdir()))==4 and legacy.exists()
 assert (data/br.HISTORY).exists() and book.read_bytes()==before
 assert recovery.status(app)['state']=='green'
 preview=recovery.preview({'path':result['path']});assert preview['version']=='3.32.36-alpha.1'
 restored=Path(recovery.restore(app,preview)['folder']);assert (restored/'User-Data'/br.SETTINGS).exists()
 assert json.loads((restored/'data-location.json').read_text())['path']=='User-Data'
print('PASS Starter external-data retention, legacy-set protection, completion marker, verified backup/status and isolated restore.')
