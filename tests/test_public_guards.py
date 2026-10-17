"""Focused local-server and archive boundary checks using synthetic requests."""
import io,sys,tempfile,zipfile
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import expense_book as app,recovery

with tempfile.TemporaryDirectory() as td:
    old=app.DATA;app.DATA=Path(td)
    try:
        req=SimpleNamespace(path='/api/years',server=SimpleNamespace(server_port=12345),headers={'Host':'127.0.0.1:12345','X-App-Token':app.TOKEN})
        app.Handler.guard(req,True)
        for change in [{'Host':'untrusted.example:12345'},{'Origin':'https://untrusted.example'},{'X-App-Token':'wrong'}]:
            previous=req.headers.copy();req.headers.update(change)
            try:app.Handler.guard(req,True);raise AssertionError('Unauthorized request accepted')
            except app.UserError as e:assert e.status==403
            finally:req.headers=previous
        for name in ['../outside','/absolute','App/../../outside','App/file:stream','App/CON','App/name.','App\\outside']:
            assert not recovery.safe_name(name),name
        for entries in [{'xl/workbook.xml':'<workbook/>','xl/vbaProject.bin':'macro'}, {'not-workbook.txt':'text'}]:
            b=io.BytesIO()
            with zipfile.ZipFile(b,'w') as z:
                for name,text in entries.items():z.writestr(name,text)
            try:app.validate_xlsx(b.getvalue());raise AssertionError('Unsupported workbook accepted')
            except app.UserError:pass
    finally:app.DATA=old
print('PASS local request host/origin/token guards, unsafe recovery paths, and unsupported workbook rejection.')
