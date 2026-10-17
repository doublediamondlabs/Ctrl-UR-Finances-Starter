from pathlib import Path
import sys,importlib.util,tempfile,copy,json
p=Path(__file__).resolve().parents[1]/'app';sys.path.insert(0,str(p));spec=importlib.util.spec_from_file_location('expense_book',p/'expense_book.py');app=importlib.util.module_from_spec(spec);sys.modules['expense_book']=app;spec.loader.exec_module(app);import rearview
data={'title':'Our year','intro':'','outlook':'','cover':None,'months':[{'note':'','photos':[]} for _ in range(12)]}
with tempfile.TemporaryDirectory() as tmp:
 app.ROOT=Path(tmp);app.DATA=app.ROOT;app.CONFIG=app.ROOT/'linked-workbooks.json';app.CONFIG.write_text('{"years":{},"keep":true}')
 first=rearview.read(app,2026);saved=rearview.save(app,{'year':2026,'revision':first['revision'],'data':data});assert saved['data']==data
 assert rearview.read(app,2027)['data'] is None
 try:rearview.save(app,{'year':2026,'revision':first['revision'],'data':data});raise AssertionError()
 except app.UserError as e:assert e.status==409
 bad=copy.deepcopy(data);bad['months'][0]['photos']=[{'image':'https://example.com','caption':''}]
 try:rearview.save(app,{'year':2026,'revision':saved['revision'],'data':bad});raise AssertionError()
 except app.UserError:pass
 assert rearview.read(app,2026)==saved;assert json.loads(app.CONFIG.read_text())['keep']
 data['months'][9]['note']='Arrowhead weekend';rearview.save(app,{'year':2026,'revision':saved['revision'],'data':data});assert rearview.read(app,2026)['data']==data
print('PASS yearly persistence, year isolation, concurrent edit rejection, invalid image rejection, settings preserved.')
