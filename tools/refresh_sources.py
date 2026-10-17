from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
names=[]
root_names={'LICENSE','SUPPORT.md','SECURITY.md','CONTRIBUTING.md','README.md','FIRST-UPLOAD.txt','ALIGN-VERSIONS.txt','.gitignore','.gitattributes','package.json','package-lock.json','LAST-VERIFIED.json'}
for n in sorted(root_names):
 if (ROOT/n).is_file():names.append(n)
for folder,extensions in [('tools',{'.py','.mjs','.json'}),('tests',{'.py','.mjs','.jsx','.md'}),('docs',{'.md','.txt'}),('examples',{'.md','.txt'}),('app/Source',{'.jsx','.js','.ts','.json'}),('app/web',{'.js','.css','.html','.svg'})]:
 for f in (ROOT/folder).iterdir():
  if f.is_file() and not f.is_symlink() and f.suffix in extensions and (folder=='tests' or not f.name.startswith('qa-')) and not (folder=='app/Source' and f.suffix=='.json' and f.name not in {'package.json','package-lock.json'}):names.append(f.relative_to(ROOT).as_posix())
  elif folder=='tests' and f.is_file() and f.suffix=='.jsx':names.append(f.relative_to(ROOT).as_posix())
for f in (ROOT/'app').iterdir():
 if f.is_file() and not f.is_symlink() and (f.suffix=='.py' or f.name in {'Ctrl-Ur-Finances.ico','Install-Desktop-Shortcut.bat','Start-App-Diagnostics.bat','Start-App.bat','Create-Portable-Copy.bat','README-STARTER.txt','PORTABLE-GUIDE.txt','THIRD-PARTY-NOTICES.txt'}):names.append(f.relative_to(ROOT).as_posix())
names.append('tools/source-files.json')
(ROOT/'tools/source-files.json').write_text(json.dumps(sorted(set(names)),indent=2)+'\n')
print('Refreshed program/source allowlist. Review it before committing.')
