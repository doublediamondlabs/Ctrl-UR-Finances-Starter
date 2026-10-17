"""Create an isolated, labeled practice source copy. Never accepts an app/data folder."""
from pathlib import Path
import sys,shutil,json
ROOT=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2:raise SystemExit('Usage: python tools/practice.py NEW-EMPTY-DESTINATION')
dest=Path(sys.argv[1]).expanduser().resolve()
if dest.exists():raise SystemExit('Choose a NEW folder. Existing folders are never overwritten.')
if dest.is_relative_to(ROOT) or ROOT.is_relative_to(dest):raise SystemExit('Choose a separate sibling folder outside this repository.')
if not (ROOT/'LAST-VERIFIED.json').is_file():raise SystemExit('Run only from the provided source repository.')
# Explicit source allowlist prevents carrying links to real data into the practice copy.
base=json.loads((ROOT/'tools/source-files.json').read_text())
for name in base:
    p=ROOT/name
    if not p.is_file() or p.is_symlink():raise SystemExit('Missing or linked source file: '+name)
for name in base:
    target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,target)
(dest/'PRACTICE-ONLY.txt').write_text('This is a development exercise. Do not install its packages on your live or starter data.\n')
source=dest/'app/Source/main.jsx';text=source.read_text(encoding='utf-8')
needle="['find',Search,'Find That Thing']"
if text.count(needle)!=1:raise SystemExit('Practice copy created, but the label could not be safely changed. Ask your helper to inspect main.jsx.')
source.write_text(text.replace(needle,"['find',Search,'Find That Thing (Practice)']"),encoding='utf-8')
print('Practice source created: '+str(dest))
print('Install dependencies, build and verify there. Only the sidebar label was changed. No workbooks or settings were copied.')
