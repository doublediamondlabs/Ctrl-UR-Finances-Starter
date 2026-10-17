from pathlib import Path
import tempfile,sys,json,hashlib,base64,types
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import inspection_store as store
class Error(Exception):
 def __init__(self,message,code=400):super().__init__(message);self.code=code
with tempfile.TemporaryDirectory() as temp:
 root=Path(temp);config=root/'linked-workbooks.json';wb=root/'2026.xlsx';wb.write_bytes(b'old workbook');config.write_text(json.dumps({'years':{'2026':{}},'reporting':{'businessDefaults':{'processor':'Keep me'}},'movePlanner':{'keep':True}}))
 digest=lambda b:hashlib.sha256(b).hexdigest()
 def atomic(path,data,backup=False):path.write_bytes(data)
 app=types.SimpleNamespace(ROOT=root,DATA=root,CONFIG=config,Path=Path,UserError=Error,digest=digest,load_config=lambda:json.loads(config.read_text()),workbook_path=lambda y:(wb,None),ensure_unlocked=lambda p:None,validate_xlsx=lambda b:None,atomic_file=atomic,pack_year=lambda y:{'year':y,'base64':base64.b64encode(wb.read_bytes()).decode(),'revision':digest(wb.read_bytes())})
 item={'id':'murray','name':'Bishs Murray','address':'Test Murray KY','notes':'Usual route','miles':120,'reminder':'Use east entrance','zip':'01234-5678'}
 store.validate_destinations(app,[{**item,'city':'Almo','state':'KY','dealerName':"Bish's of Murray",'locationType':'dealer'}])
 shared={'sharedVersion':1,'linkedYears':[2026]}
 def body(previous,items):return {'sharedRevision':digest((root/'inspection-history.json').read_bytes() if (root/'inspection-history.json').exists() else b''),'shared':shared,'books':[{'year':2026,'path':str(wb),'revision':digest(wb.read_bytes()),'base64':base64.b64encode(b'new workbook').decode()}],'destinations':{'previous':previous,'items':items}}
 initial=config.read_bytes();oldwb=wb.read_bytes()
 # Fail after config has been written; rollback must restore both files and remove new history.
 def fail(path,data,backup=False):
  if path==wb and data==b'new workbook':raise OSError('simulated disk failure')
  path.write_bytes(data)
 app.atomic_file=fail
 try:store.save(app,body([],[item]));raise AssertionError('expected failure')
 except OSError:pass
 assert config.read_bytes()==initial and wb.read_bytes()==oldwb and not (root/'inspection-history.json').exists()
 app.atomic_file=atomic;result=store.save(app,body([],[item]));assert result['reporting']['savedDestinations']==[item];cfg=json.loads(config.read_text());assert cfg['movePlanner']=={'keep':True};assert cfg['reporting']['businessDefaults']['processor']=='Keep me'
 unchanged=(config.read_bytes(),wb.read_bytes())
 try:store.save(app,body([],[]));raise AssertionError('stale save accepted')
 except Error as e:assert e.code==409
 assert unchanged==(config.read_bytes(),wb.read_bytes())
 for bad in [[{**item,'miles':float('nan')}],[item,{**item,'id':'other','name':'  BISHS  MURRAY '}],[{**item,'miles':True}]]:
  try:store.validate_destinations(app,bad);raise AssertionError('bad destination accepted')
  except Error:pass
 print('PASS atomic destination/workbook save, rollback on disk failure, stale-write rejection, unrelated settings preservation and validation.')
