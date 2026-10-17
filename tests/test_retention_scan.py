"""Preview is metadata-only, nonblocking, cancellable, and reports failures."""
import sys,tempfile,threading,time
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import backup_retention as br,recovery
with tempfile.TemporaryDirectory() as td:
 root=Path(td);folder=root/'Portable-Data'/'Archive'/'Year-2026'/'Expense-Book-Backups'/'Annual';folder.mkdir(parents=True)
 for i in range(15):(folder/f'20200101-120000-{i:06d}.xlsx').write_bytes(b'no workbook reads needed')
 app=SimpleNamespace(ROOT=root,DATA=root,load_config=lambda:{'years':{'2026':{'path':str(root/'missing.xlsx')}}},resolve_path=Path)
 def forbidden(*a,**k):raise AssertionError('Full inventory / workbook reads forbidden during preview')
 original=recovery.inventory;recovery.inventory=forbidden
 result=br.preview(app);assert result['folders'][0]['remove']==5
 recovery.inventory=original
 entered=threading.Event();release=threading.Event();original_preview=br.preview
 def delayed(app,progress):
  progress(root);entered.set();release.wait(3);progress(folder);return {'folders':[]}
 br.preview=delayed
 job=br.start_preview(app);assert entered.wait(1);assert br.scanning();assert br.scan_progress()['checked']>=1
 br.cancel_scan();assert br.scan_progress()['cancelling'];release.set()
 for _ in range(100):
  if not br.scanning():break
  time.sleep(.01)
 assert br.scan_progress()['state']=='cancelled'
 br.preview=lambda *a:(_ for _ in ()).throw(OSError('Synthetic unavailable share'))
 br.start_preview(app)
 for _ in range(100):
  if not br.scanning():break
  time.sleep(.01)
 assert br.scan_progress()['state']=='failed' and 'unavailable share' in br.scan_progress()['error']
 br.preview=original_preview
 assert len(list(folder.iterdir()))==15 and not (root/br.SETTINGS).exists()
print('PASS preview avoids workbook reads/full inventory; background progress, cancel, errors, and no mutation.')
