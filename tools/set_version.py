"""Change active release version fields; leaves historical docs and baseline alone."""
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2 or not re.fullmatch(r'\d+\.\d+\.\d+(?:-alpha\.\d+)?',sys.argv[1]):raise SystemExit('Usage: python tools/set_version.py 3.32.17 (or 3.32.17-alpha.1 for starter)')
new=sys.argv[1];p=ROOT/'app/Source/package.json';old=json.loads(p.read_text())['version']
if ('-alpha.' in old)!=('-alpha.' in new):raise SystemExit('Keep live and experimental starter version families separate.')
for name in ['app/Source/package.json','app/Source/package-lock.json','package.json','package-lock.json']:
    f=ROOT/name;d=json.loads(f.read_text());d['version']=new
    if 'packages' in d:d['packages']['']['version']=new
    f.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
for name in ['app/Source/main.jsx','app/Source/Starter.jsx','app/expense_book.py','app/web/index.html','app/preferences.py','app/portable_copy.py']:
    f=ROOT/name
    if f.exists():f.write_text(f.read_text(encoding='utf-8').replace(old,new),encoding='utf-8')
# Keep repository housekeeping files visibly aligned with each release.
for name in ['.gitignore','.gitattributes']:
    f=ROOT/name
    if f.exists():
        lines=f.read_text(encoding='utf-8').splitlines()
        if lines and lines[0].startswith('# Repository release: '):lines.pop(0)
        f.write_text('# Repository release: v'+new+'\n'+'\n'.join(lines)+'\n',encoding='utf-8')
print('Set version '+new+'. Update README/release notes, then run python tools/release.py. The last verified baseline was not changed.')
