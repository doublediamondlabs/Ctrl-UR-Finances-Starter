"""Repeatable checks, using only synthetic temporary data. Run from a source repository."""
from pathlib import Path
import sys,subprocess,json,hashlib,os,ast
ROOT=Path(__file__).resolve().parents[1]
def run(args):
    print('RUN '+' '.join(str(x) for x in args),flush=True)
    subprocess.run(args,cwd=ROOT,check=True,env={**os.environ,'PYTHON':sys.executable})
def verify():
    version=json.loads((ROOT/'app/Source/package.json').read_text())['version']
    for name in ['expense_book.py','Source/main.jsx','web/index.html']:
        if version not in (ROOT/'app'/name).read_text(encoding='utf-8'): raise ValueError('Version mismatch: '+name)
    for path in (ROOT/'app').glob('*.py'): ast.parse(path.read_text(encoding='utf-8'),filename=str(path))
    before=(ROOT/'app/web/app.js').read_bytes()
    run(['node',str(ROOT/'tools/build_frontend.mjs')])
    if before!=(ROOT/'app/web/app.js').read_bytes():raise ValueError('Bundle did not match source. It has been rebuilt. Review the change, then run verification again.')
    for path in sorted((ROOT/'tests').glob('test*.py')): run([sys.executable,str(path)])
    for path in sorted((ROOT/'tests').glob('test*.mjs')): run(['node',str(path)])
    print('PASS: version, syntax, reproducible frontend and automated checks. Complete the manual pilot before installing a new feature on live data.')
if __name__=='__main__':verify()
