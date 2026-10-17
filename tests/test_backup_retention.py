"""Synthetic retention boundary, deletion safety, and verified-backup integration checks."""
import sys,tempfile,json,datetime as dt,os,zipfile
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import backup_retention as br, recovery
now=dt.datetime(2026,10,16,12)
def item(i,date):return {'path':str(i),'date':date}
old=[item(i,now-dt.timedelta(days=500+i)) for i in range(12)]
assert br.kept(old,now)==set(map(str,range(10)))
entries=[item(i,now-dt.timedelta(days=i//3,hours=i%3)) for i in range(120)]
keep=br.kept(entries,now)
assert all(str(i) in keep for i in range(21))
assert '24' in keep and '25' not in keep # newest daily after 7 days
assert br.kept(old,now,True)=={'0','1','2'}
assert br.month_floor(dt.datetime(2024,2,29)).day==28
with tempfile.TemporaryDirectory() as td:
 root=Path(td)/'App';root.mkdir();book=root/'Portable-Data'/'Archive'/'Year-2026'/'Annual.xlsx';book.parent.mkdir(parents=True);book.write_bytes(b'synthetic workbook')
 cfg={'years':{'2026':{'path':str(book)}}}
 (root/'linked-workbooks.json').write_text(json.dumps(cfg))
 (root/'Start-App.bat').write_text('synthetic')
 (root/'expense_book.py').write_text('synthetic')
 app=SimpleNamespace(ROOT=root,DATA=root,CONFIG=root/'linked-workbooks.json',load_config=lambda:json.loads((root/'linked-workbooks.json').read_text()),resolve_path=lambda p:Path(p),ensure_unlocked=lambda p:None,validate_xlsx=lambda b:None,__doc__='Expense Book 3.32.34')
 def atomic(p,data,backup=False):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 app.atomic_file=atomic
 recovery.counts=lambda p:{}
 folders=[book.parent/'Expense-Book-Backups'/book.stem,root/'Loan-Tracker-Backups',root/'Inspection-History-Backups',root/'App-Update-Backups']
 for folder in folders:folder.mkdir(parents=True)
 for i in range(15):
  stamp=(dt.datetime.now()-dt.timedelta(days=500+i)).strftime('%Y%m%d-%H%M%S-%f')
  (folders[0]/(stamp+'.xlsx')).write_bytes(b'workbook'+str(i).encode())
  (folders[1]/(stamp+'.json')).write_text('{}')
  ins=folders[2]/stamp;ins.mkdir();(ins/'0-Annual.xlsx').write_bytes(b'old');(ins/'1-inspection-history.json').write_text('{}')
  update=folders[3]/('before-update-to-v3.32.20-'+stamp);update.mkdir();(update/'PROGRAM-MANIFEST.json').write_text('{}');(update/'expense_book.py').write_text('previous')
 (folders[0]/'manual-keep.xlsx').write_bytes(b'untouched')
 (root/'unrelated.txt').write_text('untouched')
 sources=recovery.inventory(app)[1]
 assert len(br.plan(app,sources))==4
 assert [len(g['remove']) for g in br.plan(app,sources)]==[5,5,5,12]
 assert not br.read(app)['enabled']
 try:br.configure(app,{'enabled':True});raise AssertionError('No review accepted')
 except ValueError:pass
 br.configure(app,{'enabled':True,'reviewed':True})
 (root/'inspection-transaction.json').write_text('{}');assert not br.plan(app,sources);(root/'inspection-transaction.json').unlink()
 # Sparse histories and unrecognized files persist; excluded updates cannot be pruned.
 no_updates=recovery.inventory(app,include_updates=False)[1]
 assert all(g['kind']!='Program update' for g in br.plan(app,no_updates))
 result=recovery.create(app,{'destination':str(Path(td)/'Snapshots'),'includeUpdateArchives':False})
 assert result['state']=='green',result
 assert recovery.status(app)['state']=='green'
 assert len(list(folders[0].glob('*.xlsx')))==11
 assert len(list(folders[1].glob('*.json')))==10
 assert len(list(folders[2].iterdir()))==10
 assert len(list(folders[3].iterdir()))==15
 assert book.read_bytes()==b'synthetic workbook'
 history=br.read(app)['history'];assert history[0]['files']==20
 record=json.loads((root/'backup-status.json').read_text())
 with zipfile.ZipFile(record['path']) as z:
  assert sum('/Expense-Book-Backups/Annual/' in n for n in z.namelist())==16
 assert br.clean(app,record)==[] # once per local day
 # After reset, changed candidate is skipped even though snapshot contained its old bytes.
 (root/br.HISTORY).unlink()
 saved=json.loads((root/'backup-status.json').read_text());saved.pop('cleanupSummary',None);(root/'backup-status.json').write_text(json.dumps(saved))
 candidates=br.plan(app,record['sources'])
 # Update histories were excluded, add a fresh snapshot with update archives.
 result=recovery.create(app,{'destination':str(Path(td)/'Snapshots')})
 assert result['state']=='green',result
 assert len(list(folders[3].iterdir()))==3
 # Construct a changed-file case without invoking ZIP creation again.
 (root/br.HISTORY).unlink()
 saved=json.loads((root/'backup-status.json').read_text());saved.pop('cleanupSummary',None);(root/'backup-status.json').write_text(json.dumps(saved))
 for i in range(12):
  p=folders[1]/((dt.datetime.now()-dt.timedelta(days=900+i)).strftime('%Y%m%d-%H%M%S-%f')+'.json');p.write_text('{}')
 sources=recovery.inventory(app)[1];record['sources']={p:recovery.sha(p) for p in sources}
 candidate=next(g for g in br.plan(app,sources) if g['kind']=='Loan tracker')['remove'][0]['path']
 Path(candidate).write_text('{"changed":true}')
 removed=br.clean(app,record)
 assert candidate not in removed and Path(candidate).exists()
 assert br.read(app)['history'][0]['skipped']>=1
 assert (folders[0]/'manual-keep.xlsx').exists()
print('PASS retention tiers, sparse histories, complete sets, active recovery protection, archive exclusion, verified ZIP integration, status, once/day, and changed-file safety.')
