"""Build, verify, then package. Stops on the first failure."""
from pathlib import Path
import subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
for command in [['node',str(ROOT/'tools/build_frontend.mjs')],[sys.executable,str(ROOT/'tools/verify.py')],[sys.executable,str(ROOT/'tools/build_release.py')],[sys.executable,str(ROOT/'tools/check_packages.py')]]:
    subprocess.run(command,cwd=ROOT,check=True)
print('Release packages are in dist. Follow docs/MAINTENANCE.md before applying them.')
