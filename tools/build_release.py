"""Build clean distributions from allowlisted source files. Never package runtime data."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/'app/Source/package.json').read_text())['version']
OUT=ROOT/'dist'
RUNTIME_NAMES={'Ctrl-Ur-Finances.ico','quiet_start.py','Install-Desktop-Shortcut.bat','Start-App-Diagnostics.bat','backup_retention.py','rearview.py','move_planner.py','expense_book.py','preferences.py','recovery.py','portable_copy.py','deadlines.py','debts.py','inspection_store.py','Start-App.bat','Create-Portable-Copy.bat','README-STARTER.txt','PORTABLE-GUIDE.txt','THIRD-PARTY-NOTICES.txt'}
PUBLIC_FILES=['README.md','LICENSE','SUPPORT.md','SECURITY.md','CONTRIBUTING.md','docs/RELEASE-NOTES.md','docs/MAINTENANCE.md','docs/DEPENDENCIES.md','docs/DEVELOPMENT-LICENSES.txt','docs/PUBLIC-RELEASE-REVIEW.md','docs/PUBLISHING.md','examples/TRY-IT.md']
WEB_NAMES={'shortcut-icon.svg','app.js','style.css','index.html','favicon.svg'}
def runtime():
 return [ROOT/'app'/n for n in sorted(RUNTIME_NAMES)]+[ROOT/'app/web'/n for n in sorted(WEB_NAMES)]
def write_zip(path,entries):
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in sorted(entries.items()):
   info=zipfile.ZipInfo(name,date_time=(2026,10,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
def build():
 OUT.mkdir(exist_ok=True);files=runtime()
 for p in files:
  if not p.is_file() or p.is_symlink():raise ValueError('Missing/linked runtime file: '+str(p))
 starter=f'Ctrl-Ur-Finances-Starter-v{VERSION}'
 write_zip(OUT/(starter+'.zip'),{**{starter+'/'+p.relative_to(ROOT/'app').as_posix():p.read_bytes() for p in files},**{starter+'/'+n:(ROOT/n).read_bytes() for n in PUBLIC_FILES}})
 update=f'Ctrl-Ur-Finances-Starter-Update-v{VERSION}'
 entries={update+'/payload/'+p.relative_to(ROOT/'app').as_posix():p.read_bytes() for p in files}
 entries.update({update+'/payload/'+n:(ROOT/n).read_bytes() for n in PUBLIC_FILES})
 entries[update+'/payload/PROGRAM-FILES.json']=json.dumps([p.relative_to(ROOT/'app').as_posix() for p in files]+PUBLIC_FILES,indent=2).encode()
 entries[update+'/PAYLOAD-SHA256.json']=json.dumps({**{p.relative_to(ROOT/'app').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files},**{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in PUBLIC_FILES}},indent=2).encode()
 entries[update+'/apply_update.py']=(ROOT/'tools/apply_update.py').read_text().replace('for v in [', "for v in ['"+VERSION+"',",1).encode()
 entries[update+'/Apply-Update.bat']=b'@echo off\r\nsetlocal\r\npushd "%~dp0"\r\nif errorlevel 1 exit /b 1\r\nwhere py >nul 2>nul\r\nif errorlevel 1 (python "%~dp0apply_update.py") else (py -3 "%~dp0apply_update.py")\r\npopd\r\npause\r\n'
 entries[update+'/READ-ME-FIRST.txt']=b'EXPERIMENTAL STARTER UPDATE ONLY. Close the starter app and Excel. Run Apply-Update.bat and select your existing experimental starter folder. This is NOT a live Expense Book update. A fresh installation uses the separate Starter ZIP. Data and settings are backed up before replacing program files.\r\n'
 entries[update+'/WHATS-NEW.txt']=(ROOT/'docs/RELEASE-NOTES.md').read_bytes()
 write_zip(OUT/(update+'.zip'),entries)
 repo={ROOT/n for n in json.loads((ROOT/'tools/source-files.json').read_text())}
 for p in repo:
  if not p.is_file() or p.is_symlink():raise ValueError('Missing/linked repository source: '+str(p))
 write_zip(OUT/f'Ctrl-Ur-Finances-Repository-v{VERSION}.zip',{'ctrl-ur-finances/'+p.relative_to(ROOT).as_posix():p.read_bytes() for p in repo})
 sums=[]
 for p in sorted(OUT.glob(f'*v{VERSION}.zip')):sums.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name)
 (OUT/'SHA256SUMS.txt').write_text('\n'.join(sums)+'\n')
 print('\n'.join(sums))
if __name__=='__main__':build()
