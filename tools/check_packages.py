"""Check the actual ZIP payloads, then exercise updater on a temporary synthetic install."""
from pathlib import Path
import zipfile,json,tempfile,hashlib,importlib.util,shutil
ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/'app/Source/package.json').read_text())['version'];starter='-alpha.' in version
archives=list((ROOT/'dist').glob('*v'+version+'.zip'))
assert len(archives)==(3 if starter else 2),'Expected release ZIPs were not found.'
for path in archives:
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None,path
        for name in z.namelist():
            assert not any(part in name.split('/') for part in ['node_modules','User-Data','Workbooks','.git','__pycache__']),name
            assert not name.endswith(('.xlsx','linked-workbooks.json','data-location.json','appearance-logo.png','inspection-history.json')),name
            assert not Path(name).name.startswith('rearview-'),name
            if starter and name.endswith(('.py','.js','.jsx','.json','.txt','.md','.html')):
                text=z.read(name).decode('utf-8')
                # Keep checks generic: do not publish real names or financial values.
                for private in ['-----BEGIN '+'PRIVATE KEY-----','-----BEGIN '+'RSA PRIVATE KEY-----']:
                    assert private not in text,(name,private)
        prefixes=[n[:-len('expense_book.py')] for n in z.namelist() if n.endswith('/expense_book.py')]
        assert len(prefixes)==1
        for item in ['expense_book.py','web/app.js','web/index.html']:
            assert version in z.read(prefixes[0]+item).decode('utf-8'),(path,item)
update=next(p for p in archives if '-Update-' in p.name)
with tempfile.TemporaryDirectory() as td:
    temp=Path(td)
    with zipfile.ZipFile(update) as z:z.extractall(temp)
    package=temp/update.stem;payload=package/'payload'
    spec=importlib.util.spec_from_file_location('package_updater',package/'apply_update.py');up=importlib.util.module_from_spec(spec);spec.loader.exec_module(up)
    target=temp/'Synthetic-App';shutil.copytree(payload,target)
    if starter:
        (target/'PROGRAM-FILES.json').unlink(missing_ok=True)
        p=target/'expense_book.py';p.write_text(p.read_text().replace(version,'3.32.16-alpha.1'))
    cfg={'years':{},'editions':{'fixture':'unchanged'},'reporting':{'fixture':'unchanged'}}
    (target/'linked-workbooks.json').write_text(json.dumps(cfg));(target/'rearview-2026.json').write_text('{"fixture":"memory"}')
    before={p:p.read_bytes() for p in [target/'linked-workbooks.json',target/'rearview-2026.json']}
    backup=up.install(target,payload)
    assert backup.is_dir()
    for p,b in before.items():assert p.read_bytes()==b,p
    assert version in (target/'expense_book.py').read_text()
print('PASS actual ZIPs: version alignment, clean file selection, program install and saved-data preservation.')
