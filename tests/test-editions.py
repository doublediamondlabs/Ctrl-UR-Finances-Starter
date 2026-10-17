from pathlib import Path
import importlib.util,sys,tempfile,json,io,copy
p=Path(__file__).resolve().parents[1]/'app';sys.path.insert(0,str(p))
spec=importlib.util.spec_from_file_location('expense_book',p/'expense_book.py');app=importlib.util.module_from_spec(spec);sys.modules['expense_book']=app;spec.loader.exec_module(app)
settings={'visible':True,'active':'a','items':[{'id':'a','title':'Test','label':'EDITION','dedication':'Hello','reference':'2026','color':'#e6cc93','art':'trail','image':''}]}
app.validate_editions(settings)
for change in [{'active':'missing'},{'visible':'yes'},{'items':[dict(settings['items'][0],image='data:text/html,bad')]},{'items':[dict(settings['items'][0],color='red')]}]:
 try:app.validate_editions(dict(settings,**change));raise AssertionError('invalid accepted')
 except app.UserError:pass
with tempfile.TemporaryDirectory() as tmp:
 app.CONFIG=Path(tmp)/'linked-workbooks.json';app.CONFIG.write_text(json.dumps({'years':{},'reporting':{'keep':'yes'},'movePlanner':{'keep':True}}))
 cls=next(v for v in vars(app).values() if isinstance(v,type) and v.__module__==app.__name__ and hasattr(v,'do_POST'))
 def post(prev,value):
  h=object.__new__(cls);body=json.dumps({'settings':value,'previous':prev}).encode();h.headers={'Content-Length':str(len(body))};h.rfile=io.BytesIO(body);h.path='/api/editions';h.guard=lambda *_:None;result=[];h.respond=lambda data,status=200:result.append((data,status));h.do_POST();return result[0]
 assert post(None,settings)[1]==200
 cfg=app.load_config();assert cfg['editions']==settings and cfg['reporting']=={'keep':'yes'} and cfg['movePlanner']=={'keep':True}
 changed=copy.deepcopy(settings);changed['visible']=False
 assert post(None,changed)[1]==409
 assert app.load_config()['editions']==settings
 assert post(settings,changed)[1]==200
 assert app.load_config()['editions']['visible']==False
print('PASS validation, saved settings reload, other settings preserved, concurrent save rejected.')
