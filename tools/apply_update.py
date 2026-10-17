"""Program-only updater for Ctrl Ur Finances starter prereleases."""
from pathlib import Path
import datetime,hashlib,json,os,shutil,sys
ROOT=Path(__file__).resolve().parent

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def install(target,payload=None):
 target=Path(target).resolve();payload=Path(payload or ROOT/'payload');names=json.loads((payload/'PROGRAM-FILES.json').read_text())
 if not (target/'Start-App.bat').is_file() or not (target/'expense_book.py').is_file():raise ValueError('Select the EXPERIMENTAL starter folder containing Start-App.bat.')
 code=(target/'expense_book.py').read_text()
 if not any('Expense Book '+v in code for v in ['3.32.53-alpha.4','3.32.53-alpha.3','3.32.53-alpha.2','3.32.53-alpha.1','3.7.0-alpha.1','3.7.0-alpha.2','3.7.0-alpha.3','3.7.0-alpha.4','3.7.0-alpha.5','3.7.0-alpha.6','3.32.3-alpha.1','3.32.7-alpha.1','3.32.16-alpha.1','3.32.36-alpha.1','3.32.37-alpha.1','3.32.40-alpha.1']):raise ValueError('This updater is only for the experimental starter. Do not select the live Double Diamond Expense Book folder.')
 if any(Path(n).is_absolute() or '..' in Path(n).parts or n.startswith(('User-Data/','Workbooks/')) or n.endswith('.json') for n in names):raise ValueError('Invalid program manifest.')
 if any(not (payload/n).is_file() for n in names):raise ValueError('Extract the complete update ZIP first.')
 checksum=payload.parent/'PAYLOAD-SHA256.json'
 if checksum.exists():
  hashes=json.loads(checksum.read_text())
  if set(hashes)!=set(names) or any(digest(payload/n)!=hashes[n] for n in names):raise ValueError('Update payload verification failed. Extract a fresh copy of the update ZIP.')
 lock=open(target/'app-instance.lock','a+b')
 try:
  if os.name=='nt':
   import msvcrt
   if lock.seek(0,2)==0:lock.write(b'0');lock.flush()
   lock.seek(0)
   try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
   except OSError:raise ValueError('Use Exit Ctrl Ur Finances (or close the old Start-App command window), then retry the update.')
  else:
   import fcntl
   try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   except OSError:raise ValueError('Use Exit Ctrl Ur Finances (or close the old Start-App command window), then retry the update.')
  pointer=target/'data-location.json'
  relative=json.loads(pointer.read_text())['path'] if pointer.exists() else '.' if (target/'linked-workbooks.json').exists() else 'User-Data'
  data=Path(relative);data=data if data.is_absolute() else target/data
  if (data/'inspection-transaction.json').exists():raise ValueError('Restart the current app to recover the interrupted save, then close it before updating.')
  backup=target/'App-Update-Backups'/datetime.datetime.now().strftime('before-starter-update-%Y%m%d-%H%M%S-%f');backup.mkdir(parents=True)
  sources=[p for p in data.glob('*.json') if p.name!='backup-status.json']+[p for p in [pointer,data/'appearance-logo.png'] if p.is_file()]
  cfg=json.loads((data/'linked-workbooks.json').read_text()) if (data/'linked-workbooks.json').exists() else {'years':{}}
  for item in [*cfg['years'].values(),*([cfg['loan']] if cfg.get('loan') else [])]:
   path=Path(item['path']);path=path if path.is_absolute() else target/path
   if not path.is_file() or path.with_name('~$'+path.name).exists():raise ValueError('Close Excel and make every linked workbook available before updating: '+str(path))
   sources.append(path)
  manifest=[]
  for i,path in enumerate(dict.fromkeys(sources)):
   sha=digest(path);dest=backup/'Data'/f'{i}-{path.name}';dest.parent.mkdir(exist_ok=True);shutil.copy2(path,dest)
   if digest(dest)!=sha or digest(path)!=sha:raise ValueError('A data file changed while backing up. No program files were replaced.')
   manifest.append({'original':str(path),'copy':dest.relative_to(backup).as_posix(),'sha256':sha})
  (backup/'DATA-MANIFEST.json').write_text(json.dumps(manifest,indent=2));existing={}
  for name in names:
   old=target/name;existing[name]=old.exists()
   if old.exists():dest=backup/'Program'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(old,dest)
  changed=[]
  try:
   for name in names:
    dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);temp=dest.with_name(dest.name+'.update-temp');shutil.copy2(payload/name,temp);os.replace(temp,dest);changed.append(name)
  except Exception:
   for name in reversed(changed):
    if existing[name]:shutil.copy2(backup/'Program'/name,target/name)
    else:(target/name).unlink(missing_ok=True)
   for name in names:(target/name).with_name(Path(name).name+'.update-temp').unlink(missing_ok=True)
   raise
  (backup/'PROGRAM-MANIFEST.json').write_text(json.dumps(existing,indent=2))
  return backup
 finally:lock.close()
def main():
 print('Ctrl Ur Finances — experimental starter update. Close the app and Excel first.')
 try:
  import tkinter as tk
  from tkinter import filedialog
  win=tk.Tk();win.withdraw();win.attributes('-topmost',True)
  try:value=filedialog.askdirectory(title='Select the EXPERIMENTAL starter folder, not the live Expense Book')
  finally:win.destroy()
 except Exception:value=input('Experimental starter folder: ').strip().strip('"')
 if not value:print('Cancelled.');return
 try:print('Updated. Data and settings preserved. Backup: '+str(install(value)))
 except Exception as e:print('Update not completed: '+str(e));raise SystemExit(1)
if __name__=='__main__':main()
