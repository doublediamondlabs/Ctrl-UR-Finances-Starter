"""Journaled multi-workbook commit for shared inspection history."""
import json,base64,datetime,shutil,os,math

def context(app):
 p=app.DATA/'inspection-history.json';data=p.read_bytes() if p.exists() else b''
 return {'shared':json.loads(data) if data else None,'sharedRevision':app.digest(data),'books':[app.pack_year(y) for y in app.load_config()['years']]}

def recover(app):
 journal=app.DATA/'inspection-transaction.json'
 if not journal.exists():return
 state=json.loads(journal.read_text())
 for item in state['files']:
  p=app.Path(item['path'])
  if item['existed']:app.atomic_file(p,app.Path(item['backup']).read_bytes(),backup=False)
  elif p.exists():p.unlink()
 journal.unlink()

def save(app,body):
 target=app.DATA/'inspection-history.json';old=target.read_bytes() if target.exists() else b''
 if body.get('sharedRevision')!=app.digest(old):raise app.UserError('Inspection history changed in another window. Reload before saving.',409)
 config_bytes=app.CONFIG.read_bytes() if app.CONFIG.exists() else b''
 cfg=json.loads(config_bytes) if config_bytes else app.load_config();packets=body.get('books',[])
 if len(packets)!=len(cfg['years']) or set(str(p['year']) for p in packets)!=set(cfg['years']):raise app.UserError('Year links changed. Reload before saving inspection history.',409)
 shared=body.get('shared')
 if not isinstance(shared,dict) or shared.get('sharedVersion')!=1:raise app.UserError('Invalid inspection history.')
 writes=[];expected={};seen=set()
 if 'destinations' in body:
  change=body['destinations']
  if not isinstance(change,dict):raise app.UserError('Invalid destination changes.')
  validate_destinations(app,change.get('items'))
  if change.get('previous')!=cfg.get('reporting',{}).get('savedDestinations',[]):raise app.UserError('Saved destinations changed in another window. Reload before saving.',409)
  expected[app.CONFIG]=app.digest(config_bytes)
  cfg.setdefault('reporting',{})['savedDestinations']=change['items']
  writes.append((app.CONFIG,json.dumps(cfg,indent=2).encode()))
 for item in packets:
  path,_=app.workbook_path(item['year']);data=path.read_bytes()
  if path.resolve() in seen:raise app.UserError('Each year must link to a separate workbook. Nothing was written.')
  seen.add(path.resolve());expected[path]=app.digest(data)
  if item.get('path')!=str(path) or app.digest(data)!=item.get('revision'):raise app.UserError('A linked workbook changed. Reload before saving; nothing was written.',409)
  app.ensure_unlocked(path);new=base64.b64decode(item['base64'],validate=True);app.validate_xlsx(new);writes.append((path,new))
 if set(map(str,shared.get('linkedYears',[])))!=set(cfg['years']):raise app.UserError('Inspection history year links changed. Reload before saving.',409)
 expected[target]=app.digest(old);writes.append((target,json.dumps(shared,indent=2).encode()))
 folder=app.DATA/'Inspection-History-Backups'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');folder.mkdir(parents=True)
 state={'files':[]}
 for i,(path,data) in enumerate(writes):
  backup=folder/(str(i)+'-'+path.name)
  if path.exists():shutil.copy2(path,backup)
  state['files'].append({'path':str(path),'backup':str(backup),'existed':path.exists()})
 for path,_ in writes:
  if app.digest(path.read_bytes() if path.exists() else b'')!=expected[path]:raise app.UserError('A file changed during backup. Nothing was written; reload before saving.',409)
 journal=app.DATA/'inspection-transaction.json';app.atomic_file(journal,json.dumps(state).encode(),backup=False)
 try:
  for path,data in writes:app.atomic_file(path,data,backup=False)
  journal.unlink()
 except Exception:
  recover(app);raise
 return {**({'reporting':cfg['reporting']} if 'destinations' in body else {}),'saved':datetime.datetime.now().isoformat(timespec='seconds'),'sharedRevision':app.digest(target.read_bytes()),'books':[app.pack_year(p['year']) for p in packets]}


def validate_destinations(app,items):
 if not isinstance(items,list) or len(items)>500:raise app.UserError('Save at most 500 destinations.')
 ids=set();names=set()
 for d in items:
  if not isinstance(d,dict) or not {'id','name','address','notes','miles'}<=set(d) or set(d)-{'id','name','address','notes','miles','city','state','locationType','dealerName','reminder','zip'}:raise app.UserError('Invalid saved destination.')
  for key,limit in [('id',100),('name',150),('address',500),('notes',1000)]:
   if not isinstance(d[key],str) or len(d[key])>limit:raise app.UserError('Invalid destination '+key+'.')
  for key,limit in [('zip',10),('reminder',1000),('city',120),('state',2),('locationType',10),('dealerName',200)]:
   if key in d and (not isinstance(d[key],str) or len(d[key])>limit):raise app.UserError('Invalid destination '+key+'.')
  if d.get('locationType','') not in ('','dealer','private'):raise app.UserError('Invalid destination location type.')
  if d.get('state','') and d['state'] not in 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AS GU MP PR VI'.split():raise app.UserError('Invalid destination state.')
  name=' '.join(d['name'].split()).lower()
  if not d['id'] or d['id'] in ids or not name or name in names:raise app.UserError('Give each destination a unique short name.')
  miles=d['miles']
  if isinstance(miles,bool) or not isinstance(miles,(int,float)) or not math.isfinite(miles) or not 0<=miles<=100000:raise app.UserError('Enter valid round-trip mileage.')
  ids.add(d['id']);names.add(name)


def validate_dealer_reviews(app,items):
 if not isinstance(items,dict) or len(items)>10000 or len(json.dumps(items))>4000000:raise app.UserError('Invalid dealer review acknowledgements.')
 for key,value in items.items():
  if not isinstance(key,str) or len(key)>500 or not isinstance(value,dict) or set(value)!={'signature','note','reviewedAt'}:raise app.UserError('Invalid dealer review acknowledgement.')
  for field,limit in [('signature',12000),('note',1000),('reviewedAt',100)]:
   if not isinstance(value[field],str) or not value[field].strip() or len(value[field])>limit:raise app.UserError('Enter a valid dealer review explanation.')
