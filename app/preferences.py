"""Local household setup and optional feature preferences. No external services."""
import base64,copy,json,struct,zlib
from pathlib import Path
MODULES=('move','business','inspections','rom','loans','family')
COLORS={'ocean':'#176b80','forest':'#286344','plum':'#70427d','slate':'#41536b','rust':'#934723'}
def defaults(existing=False):
 return {'householdName':'My household','title':'Ctrl Ur Finances','tagline':'Your money, in view','accent':'ocean','logo':'','modules':{k:(existing if k not in ('move','rom') else False) for k in MODULES}}
def get(app):
 c=app.load_config();p=defaults(bool(c.get('years')));p.update(c.get('preferences',{}));p['modules']={**defaults(bool(c.get('years')))['modules'],**p.get('modules',{})};return p
def packet(app):
 c=app.load_config();p=get(app)
 return {'preferences':p,'revision':app.digest(json.dumps(p,sort_keys=True).encode()),'initialized':bool(c.get('years')) or c.get('setupComplete',False),'dataDirectory':str(app.DATA),'version':'3.32.53-alpha.2'}
def validate(app,p):
 if not isinstance(p,dict) or set(p)!=set(defaults()):raise app.UserError('Invalid application preferences.')
 for key,size in [('householdName',100),('title',60),('tagline',100)]:
  if not isinstance(p[key],str) or not p[key].strip() or len(p[key])>size:raise app.UserError('Enter a short '+key+' value.')
 if p['accent'] not in COLORS:raise app.UserError('Choose an available accent color.')
 if not isinstance(p['modules'],dict) or set(p['modules'])!=set(MODULES) or any(type(x) is not bool for x in p['modules'].values()):raise app.UserError('Choose valid module options.')
 if p['modules']['inspections'] and not p['modules']['business']:raise app.UserError('Inspections & Travel requires Business Finance. Enable Business or disable Inspections first.')
 if p['modules']['rom'] and not p['modules']['inspections']:raise app.UserError('RōM Travel Exchange requires Inspections & Travel.')
 if p['logo'] not in ('','appearance-logo.png'):raise app.UserError('Invalid logo reference.')
 return copy.deepcopy(p)
def logo_bytes(app,text):
 try:d=base64.b64decode(text,validate=True)
 except Exception:raise app.UserError('The logo could not be read. Choose a PNG or JPEG image.')
 if len(d)>2*1024*1024 or len(d)<33 or d[:8]!=b'\x89PNG\r\n\x1a\n':raise app.UserError('Choose an image that can be converted to a PNG smaller than 2 MB.')
 # Browser uploads a re-encoded PNG; validate every chunk and bound decoded dimensions.
 pos=8;seen=[];output=[d[:8]]
 while pos<len(d):
  if pos+12>len(d):raise app.UserError('Invalid PNG logo.')
  n=struct.unpack('>I',d[pos:pos+4])[0];kind=d[pos+4:pos+8];end=pos+12+n
  if end>len(d) or (zlib.crc32(d[pos+4:pos+8+n])&0xffffffff)!=struct.unpack('>I',d[pos+8+n:end])[0]:raise app.UserError('Invalid PNG logo.')
  if not seen:
   if kind!=b'IHDR' or n!=13:raise app.UserError('Invalid PNG logo.')
   w,h=struct.unpack('>II',d[pos+8:pos+16])
   if not 1<=w<=1024 or not 1<=h<=1024:raise app.UserError('Logo dimensions must be at most 1024 × 1024.')
  if len(kind)!=4 or not all(65<=c<=90 or 97<=c<=122 for c in kind):raise app.UserError('Invalid PNG logo.')
  if kind==b'IHDR' and seen:raise app.UserError('Invalid PNG logo.')
  if kind==b'IEND' and (n!=0 or end!=len(d)):raise app.UserError('Invalid PNG logo.')
  # Canvas encoders differ: preserve pixel/color chunks and discard unrelated
  # ancillary metadata after validating its checksum. Unknown critical chunks
  # cannot be discarded without changing image decoding, so reject those.
  supported=(b'IHDR',b'IDAT',b'IEND',b'PLTE',b'tRNS',b'sRGB',b'gAMA',b'cHRM',b'pHYs',b'iCCP',b'cICP',b'mDCV',b'cLLI')
  if kind in supported:output.append(d[pos:end])
  elif not kind[0]&32:raise app.UserError('Unsupported PNG image structure. Choose another image.')
  seen.append(kind);pos=end
 if seen[-1]!=b'IEND' or b'IDAT' not in seen:raise app.UserError('Invalid PNG logo.')
 return b''.join(output)
def save(app,body):
 state=packet(app)
 if body.get('revision')!=state['revision']:raise app.UserError('Preferences changed in another window. Reload settings before saving.',409)
 p=validate(app,body.get('preferences'));old_logo=app.DATA/'appearance-logo.png';prior=old_logo.read_bytes() if old_logo.exists() else None
 data=logo_bytes(app,body['logoBase64']) if body.get('logoBase64') else None
 if data:p['logo']='appearance-logo.png'
 elif p['logo'] and not old_logo.is_file():raise app.UserError('Logo file is missing. Upload it again or restore the default logo.')
 c=app.load_config();c['preferences']=p
 try:
  if data:app.atomic_file(old_logo,data,backup=False)
  app.persist_config(c)
 except Exception:
  if data:
   if prior is None:old_logo.unlink(missing_ok=True)
   else:app.atomic_file(old_logo,prior,backup=False)
  raise
 return packet(app)
def setup(app,body):
 if packet(app)['initialized']:raise app.UserError('This installation is already set up. Use Modules & appearance to change its settings.',409)
 year=int(body.get('year',0))
 if not 1900<=year<=2200:raise app.UserError('Choose a calendar year between 1900 and 2200.')
 p=defaults();p['householdName']=str(body.get('householdName','')).strip();validate(app,p)
 target=Path(str(body.get('dataDirectory') or app.DATA)).expanduser().resolve()
 if target==app.ROOT or app.ROOT.is_relative_to(target) or (target.is_relative_to(app.ROOT) and target!=app.ROOT/'User-Data'):raise app.UserError('Use the default User-Data folder or a separate empty folder outside the app.')
 if target.exists() and any(target.iterdir()):raise app.UserError('Choose an empty data folder. Existing files will not be replaced.')
 raw=base64.b64decode(body.get('base64',''),validate=True);app.validate_xlsx(raw)
 old_data,old_config=app.DATA,app.CONFIG;wb=target/'Workbooks'/f'{year}-Expense-Book.xlsx';cfg=target/'linked-workbooks.json';made=[]
 try:
  app.atomic_file(wb,raw,backup=False);made.append(wb)
  c={'version':1,'setupComplete':True,'preferences':p,'years':{str(year):{'path':app.stored_path(wb),'test':False}},'navigationOrder':['overview','home'],'toolsOrder':['preferences','summary','compare','year_setup','recovery','locations','links','notes','bank','help']}
  app.atomic_file(cfg,json.dumps(c,indent=2).encode(),backup=False);made.append(cfg)
  app.atomic_file(app.ROOT/'data-location.json',json.dumps({'path':app.stored_path(target)}).encode(),backup=False)
  app.DATA=target;app.CONFIG=cfg
 except Exception:
  for path in reversed(made):path.unlink(missing_ok=True)
  app.DATA,app.CONFIG=old_data,old_config;raise
 return packet(app)

TOOL_KEYS={'preferences','summary','compare','recurring','year_setup','move_setup','categories','business_defaults','bank','debts','locations','recovery','links','help'}
def tools_layout(app,client,body=None):
 if not isinstance(client,str) or len(client)!=36 or any(c not in '0123456789abcdef-' for c in client):raise app.UserError('Invalid browser preference identifier.')
 cfg=app.load_config();layouts=cfg.get('toolLayouts',{});current=layouts.get(client,{})
 if body is None:return {'layout':current}
 layout=body.get('layout')
 if not isinstance(layout,dict) or set(layout)!={'pins','order'}:raise app.UserError('Invalid tools layout.')
 for values in layout.values():
  if not isinstance(values,list) or len(values)>len(TOOL_KEYS) or any(not isinstance(k,str) or k not in TOOL_KEYS for k in values) or len(set(values))!=len(values):raise app.UserError('Invalid tool choices.')
 if body.get('previous')!=current:raise app.UserError('Tools changed in another window. Reload shortcuts and try again.',409)
 if client not in layouts and len(layouts)>=100:raise app.UserError('Too many saved browser layouts.')
 cfg['toolLayouts']={**layouts,client:layout};app.persist_config(cfg);return {'layout':layout}
