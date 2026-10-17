"""Real filesystem boundary checks using only temporary synthetic records."""
import io,json,sys,tempfile,zipfile
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import expense_book as app,file_access as access,rearview,recovery,preferences

def denied(call):
    try:call()
    except (ValueError,app.UserError):return
    raise AssertionError('Unapproved path accepted')

with tempfile.TemporaryDirectory() as td:
    root=Path(td);data=root/'data';data.mkdir();outside=root/'data-neighbor';outside.mkdir()
    internal=data/'book.xlsx';external=outside/'book.xlsx'
    internal.write_bytes(b'internal');external.write_bytes(b'outside unchanged')
    fake=SimpleNamespace(DATA=data,ROOT=root/'app',load_config=lambda:{'years':{}},resolve_path=Path,UserError=app.UserError)
    assert access.workbook(fake,str(internal))==internal
    for value in [str(external),str(data/'..'/'data-neighbor'/'book.xlsx'),str(external)+'\0']:
        denied(lambda:access.workbook(fake,value))
    # A chooser grant is for the exact selected file, not the containing directory.
    access.remember('workbook',external)
    assert access.workbook(fake,str(external))==external
    denied(lambda:access.workbook(fake,str(outside/'other.xlsx')))
    denied(lambda:access.request_path(str(external),'archive',data))
    access._GRANTS.clear()
    denied(lambda:access.workbook(fake,str(external)))
    # Existing workbook connections survive restart without choosing them again.
    fake.load_config=lambda:{'years':{'2026':{'path':str(external)}}}
    assert access.workbook(fake,str(external))==external
    # A path label submitted for a revision check never authorizes a different file.
    assert access.matches(str(external),external,fake.ROOT)
    assert not access.matches(str(internal),external,fake.ROOT)
    # Setup defaults work; arbitrary external destinations need native selection.
    assert access.request_path(str(data),'setup',data,descendants=False)==data
    denied(lambda:access.request_path(str(outside),'setup',data,descendants=False))
    access.remember('setup',outside)
    assert access.request_path(str(outside),'setup',data,descendants=False)==outside
    # Symlinks inside the data directory cannot escape its boundary.
    link=data/'escape'
    try:link.symlink_to(outside,target_is_directory=True)
    except (OSError,NotImplementedError):pass
    else:
        fake.load_config=lambda:{'years':{}}
        denied(lambda:access.workbook(fake,str(link/'book.xlsx')))
        denied(lambda:access.archive_member(data,'escape/book.xlsx'))
    for name in ['../escaped',str(outside/'escaped'),'../../escaped']:
        denied(lambda:access.archive_member(data,name))
    assert access.archive_member(data,'App/valid.txt')==data/'App'/'valid.txt'
    for year in ['../../outside',True,1899,2201,2026.0]:
        denied(lambda:rearview.target(fake,year))
    assert rearview.target(fake,2026)==data/'rearview-2026.json'
    denied(lambda:recovery.preview({'path':str(external)},fake))
    (data/'backup-status.json').write_text(json.dumps({'path':str(external)}))
    assert recovery.archive_path(fake,str(external))==external
    denied(lambda:recovery.archive_path(fake,str(outside/'other.zip')))
    assert external.read_bytes()==b'outside unchanged'
print('PASS file boundaries: exact/purpose-scoped chooser grants, existing links, traversal/sibling/symlink rejection, setup approval, restore containment and finite yearbook names.')
