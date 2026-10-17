"""Double Diamond Expense Book 3.32.53-alpha.4 -- local files only, Python standard library."""
import backup_retention, file_access
import rearview, preferences, move_planner, recovery, deadlines, debts, inspection_store
import socket, urllib.request
import argparse, base64, datetime as dt, hashlib, io, json, os, secrets, shutil, sys, tempfile, threading, webbrowser, zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parent
LOCATION = ROOT / 'data-location.json'
if LOCATION.exists():
    data_value=Path(json.loads(LOCATION.read_text())['path']);DATA=data_value if data_value.is_absolute() else ROOT/data_value
    if not DATA.is_dir():raise RuntimeError('The configured data folder is unavailable. Restore its connection before opening the app: '+str(DATA))
else:DATA=ROOT if (ROOT/'linked-workbooks.json').exists() else ROOT/'User-Data'
DATA=DATA.resolve()
CONFIG = DATA / 'linked-workbooks.json'
TOKEN = secrets.token_urlsafe(32)
INSTANCE = secrets.token_urlsafe(24)
MAX_BYTES = 24 * 1024 * 1024

def validate_link_change(current_config,route,body):
    current_item=current_config.get('loan') if route in ('/api/loan/link','/api/loan/create') else current_config.get('years',{}).get(str(body.get('year')))
    guard=body.get('linkGuard') or {}
    if guard.get('action')!=route.removeprefix('/api/') or 'previous' not in guard:
        raise UserError('Unlock link settings and confirm the connection change in the app.',409)
    if guard['previous']!=(current_item or {}).get('path'):
        raise UserError('This connection changed in another window. Reload and review it again.',409)


class UserError(Exception):
    def __init__(self, message, status=400): super().__init__(message); self.status=status

def validate_editions(settings):
    import re
    if not isinstance(settings,dict) or set(settings)!={'visible','active','items'} or type(settings['visible']) is not bool: raise UserError('Invalid edition settings.')
    items=settings['items']
    if not isinstance(items,list) or not 1<=len(items)<=20: raise UserError('Keep between 1 and 20 editions.')
    ids=[]
    for item in items:
        if not isinstance(item,dict) or set(item)!={'id','title','label','dedication','reference','color','art','image'}: raise UserError('Invalid edition.')
        for key,limit in [('id',80),('title',80),('label',40),('dedication',400),('reference',200),('color',7),('art',10),('image',350000)]:
            if not isinstance(item[key],str) or len(item[key])>limit: raise UserError('Edition field is too long or invalid.')
        if not item['id'] or not item['title'].strip() or item['id'] in ids: raise UserError('Each edition needs a title and unique ID.')
        ids.append(item['id'])
        if not re.fullmatch(r'#[0-9a-fA-F]{6}',item['color']) or item['art'] not in ('trail','orion','none','image'): raise UserError('Invalid edition artwork or color.')
        if item['art']=='image' and not item['image']: raise UserError('Upload artwork or choose a built-in emblem.')
        if item['image']:
            prefix='data:image/png;base64,'
            try:
                if not item['image'].startswith(prefix): raise ValueError()
                data=base64.b64decode(item['image'][len(prefix):],validate=True)
                if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data)<24 or data[12:16]!=b'IHDR': raise ValueError()
                width=int.from_bytes(data[16:20],'big');height=int.from_bytes(data[20:24],'big')
                if not 1<=width<=480 or not 1<=height<=480: raise ValueError()
            except Exception: raise UserError('Invalid uploaded artwork. Upload it again through the edition editor.')
    if settings['active'] not in ids: raise UserError('Choose a saved edition.')

def load_config():
    if CONFIG.exists():
        try: return json.loads(CONFIG.read_text(encoding='utf-8'))
        except Exception: raise UserError('The workbook links file could not be read. Keep this file and contact support; your workbooks have not been changed.',500)
    return {'version':1,'years':{}}

def persist_config(config):
    atomic_file(CONFIG, json.dumps(config,indent=2).encode(), backup=False)

def digest(data): return hashlib.sha256(data).hexdigest()

def validate_xlsx(data):
    if len(data)>MAX_BYTES: raise UserError('This workbook exceeds the 24 MB local app limit.')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if sum(i.file_size for i in z.infolist())>100*1024*1024: raise UserError('The expanded workbook is too large.')
            if 'xl/workbook.xml' not in z.namelist(): raise UserError('Choose an Excel .xlsx workbook.')
            if any('vbaProject' in n for n in z.namelist()): raise UserError('Macro-enabled workbooks are not supported. Use an .xlsx copy.')
            if z.testzip(): raise UserError('The workbook ZIP data is damaged.')
    except zipfile.BadZipFile: raise UserError('This is not a readable .xlsx workbook. Password-protected files must be unlocked in Excel first.')

def ensure_unlocked(path):
    if path.with_name('~$'+path.name).exists():
        raise UserError('Workbook is open in Excel. Close it, then click Save entry again. Your unsaved edits are still in the form.',409)
    if os.name=='nt' and path.exists():
        import ctypes
        from ctypes import wintypes
        fn=ctypes.windll.kernel32.CreateFileW
        fn.argtypes=[wintypes.LPCWSTR,wintypes.DWORD,wintypes.DWORD,wintypes.LPVOID,wintypes.DWORD,wintypes.DWORD,wintypes.HANDLE]
        fn.restype=wintypes.HANDLE
        h=fn(str(path),0x80000000|0x40000000,0,None,3,0,None)
        if h==wintypes.HANDLE(-1).value:
            raise UserError('Cannot write the workbook. Close Excel and check that the file and its folder are writable, then retry. Your edits have not been discarded.',409)
        ctypes.windll.kernel32.CloseHandle.argtypes=[wintypes.HANDLE]
        ctypes.windll.kernel32.CloseHandle(h)

def atomic_file(path,data,backup=True):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    ensure_unlocked(path)
    backup_path=None; tmp=None
    try:
        if backup and path.exists():
            folder=path.parent/'Expense-Book-Backups'/path.stem;folder.mkdir(parents=True,exist_ok=True)
            backup_path=folder/(dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.xlsx')
            shutil.copy2(path,backup_path)
        fd,tmp=tempfile.mkstemp(prefix='.expense-book-',suffix='.tmp',dir=path.parent)
        with os.fdopen(fd,'wb') as f: f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(tmp,path);tmp=None
        return str(backup_path) if backup_path else None
    except OSError as e:
        raise UserError('The file could not be saved. Check that Excel is closed, the folder is writable, and there is free disk space. Your edits are still available. Details: '+str(e),409)
    finally:
        if tmp:
            try: os.unlink(tmp)
            except OSError: pass

def resolve_path(value):
    p=Path(value)
    return p if p.is_absolute() else ROOT/p

def stored_path(path):
    try: return Path(path).resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError: return str(Path(path).resolve())

def workbook_path(year):
    config=load_config();item=config['years'].get(str(year))
    if not item: raise UserError('Link or create a workbook for this year first.',404)
    p=resolve_path(item['path'])
    if not p.exists(): raise UserError('The linked workbook was moved or is unavailable. Use Link workbook to select its current location. Nothing has been overwritten.',404)
    return p,item

def pack_year(year):
    p,item=workbook_path(year);data=p.read_bytes();validate_xlsx(data)
    return {'year':int(year),'path':str(p),'name':p.name,'test':item.get('test',False),'base64':base64.b64encode(data).decode(),'revision':digest(data)}

def check_setup_source(year,body):
    if 'sourceYear' not in body: return
    sy=int(body['sourceYear'])
    if sy>=int(year): raise UserError('Destination year must follow the source year.')
    source,_=workbook_path(sy)
    if not body.get('sourcePath') or not file_access.matches(body['sourcePath'],source,ROOT): raise UserError('Source workbook link changed. Preview year setup again.',409)
    if body.get('sourceRevision')!=digest(source.read_bytes()): raise UserError('Source workbook changed. Preview year setup again.',409)

def save_year(year,body):
    check_setup_source(year,body)
    p,_=workbook_path(year)
    if body.get('workbookPath') and not file_access.matches(body['workbookPath'],p,ROOT): raise UserError('Destination workbook link changed. Preview again.',409)
    current=p.read_bytes()
    if body.get('revision')!=digest(current): raise UserError('The workbook changed outside this window. Your edits were not saved. Copy any text you need, click Reload workbook, and apply your change to the newer version.',409)
    try: data=base64.b64decode(body.get('base64',''),validate=True)
    except Exception: raise UserError('The submitted workbook data is invalid.')
    validate_xlsx(data)
    backup=atomic_file(p,data)
    return {'revision':digest(data),'backup':backup,'saved':dt.datetime.now().isoformat(timespec='seconds')}

def pack_loan():
    item=load_config().get('loan')
    if not item: return {'linked':False}
    p=resolve_path(item['path'])
    if not p.is_file(): raise UserError('The loan workbook was moved. Link its current location in Family Loan.',404)
    data=p.read_bytes();validate_xlsx(data)
    return {'linked':True,'path':str(p),'name':p.name,'base64':base64.b64encode(data).decode(),'revision':digest(data)}

def save_loan(body):
    item=load_config().get('loan')
    if not item: raise UserError('Link the loan workbook first.')
    p=resolve_path(item['path'])
    if body.get('loanPath') and not file_access.matches(body['loanPath'],p,ROOT): raise UserError('The loan link changed in another window. Reload the loan before saving.',409)
    current=p.read_bytes()
    if body.get('revision')!=digest(current): raise UserError('The loan workbook changed outside this window. Reload the loan before saving.',409)
    try: data=base64.b64decode(body.get('base64',''),validate=True)
    except Exception: raise UserError('Invalid loan workbook data.')
    validate_xlsx(data);backup=atomic_file(p,data)
    return {'revision':digest(data),'backup':backup,'saved':dt.datetime.now().isoformat(timespec='seconds')}

def picker():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root=tk.Tk();root.withdraw();root.attributes('-topmost',True)
        try: return file_access.remember('workbook',filedialog.askopenfilename(title='Link an Excel workbook',filetypes=[('Excel workbook','*.xlsx')]))
        finally: root.destroy()
    except Exception:
        raise UserError('The file picker is unavailable. Paste the full workbook path in the Link workbook form instead.')

class Handler(BaseHTTPRequestHandler):
    def log_message(self,fmt,*args):
        if args and str(args[1]) not in ('200','204'): print(fmt%args)
    def respond(self,obj,status=200):
        payload=json.dumps(obj).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    def guard(self,api=False):
        if api and urlsplit(self.path).path!='/api/app/exit' and (DATA/'inspection-transaction.json').exists(): raise UserError('An interrupted save needs recovery. Close the app and restart Start-App before editing further. Keep all linked workbooks available.',409)
        expected='127.0.0.1:'+str(self.server.server_port)
        if self.headers.get('Host')!=expected: raise UserError('Invalid local host.',403)
        origin=self.headers.get('Origin')
        if origin and origin!='http://'+expected: raise UserError('This request did not come from the local app.',403)
        if api and not secrets.compare_digest(self.headers.get('X-App-Token',''),TOKEN): raise UserError('This app session expired. Close this tab and reopen Ctrl Ur Finances using your desktop shortcut.',403)
    def do_GET(self):
        try:
            route=urlsplit(self.path);self.guard(route.path.startswith('/api/'))
            if route.path=='/api/tool-layout': return self.respond(preferences.tools_layout(sys.modules[__name__],parse_qs(route.query).get('client',[''])[0]))
            if route.path=='/api/preferences': return self.respond(preferences.packet(sys.modules[__name__]))
            if route.path=='/logo.png':
                path=DATA/'appearance-logo.png'
                if not preferences.get(sys.modules[__name__]).get('logo') or not path.is_file():return self.respond({'error':'Logo not configured'},404)
                data=path.read_bytes();self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data);return
            if route.path=='/app-instance': return self.respond({'instance':INSTANCE})
            if route.path=='/api/inspection/context': return self.respond(inspection_store.context(sys.modules[__name__]))
            if route.path=='/api/move-planner': return self.respond(move_planner.read(sys.modules[__name__]))
            if route.path=='/api/backup/retention/progress': return self.respond(backup_retention.scan_progress())
            if route.path=='/api/backup/retention': return self.respond(backup_retention.read(sys.modules[__name__]))
            if route.path=='/api/backup/progress': return self.respond(recovery.progress())
            if route.path=='/api/backup/status': return self.respond(recovery.status(sys.modules[__name__],verify=False))
            if route.path=='/api/rearview': return self.respond(rearview.read(sys.modules[__name__],int(parse_qs(route.query)['year'][0])))
            if route.path=='/api/debts': return self.respond(debts.read(sys.modules[__name__]))
            if route.path=='/api/deadlines': return self.respond({'items':load_config().get('deadlines',[])})
            if route.path=='/api/loan': return self.respond(pack_loan())
            if route.path=='/api/locations':
                config=load_config()
                def location(label,item):
                    p=resolve_path(item['path']).resolve()
                    return {'label':label,'path':str(p),'exists':p.is_file(),'backups':str(p.parent/'Expense-Book-Backups'/p.stem)}
                files=[location(str(y),item) for y,item in sorted(config['years'].items())]
                if config.get('loan'): files.append(location('Family loan',config['loan']))
                return self.respond({'app':str(ROOT.resolve()),'launcher':str((ROOT/'Start-App.bat').resolve()),'config':str(CONFIG.resolve()),'data':str(DATA),'files':files})
            if route.path=='/api/years': return self.respond(load_config())
            if route.path=='/api/workbook': return self.respond(pack_year(int(parse_qs(route.query)['year'][0])))
            assets={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/favicon.svg':'favicon.svg'}
            if route.path not in assets: return self.respond({'error':'Not found'},404)
            path=ROOT/'web'/assets[route.path];payload=path.read_bytes()
            if route.path=='/': payload=payload.replace(b'__APP_TOKEN__',TOKEN.encode())
            types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}
            self.send_response(200);self.send_header('Content-Type',types[path.suffix]);self.send_header('Content-Length',str(len(payload)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'");self.end_headers();self.wfile.write(payload)
        except UserError as e: self.respond({'error':str(e)},e.status)
        except Exception as e: self.respond({'error':'Could not load the workbook: '+str(e)},500)
    def do_POST(self):
        try:
            self.guard(True)
            length=int(self.headers.get('Content-Length','0'))
            if length>MAX_BYTES*2: raise UserError('Request is too large.')
            body=json.loads(self.rfile.read(length) or b'{}');route=urlsplit(self.path).path
            if getattr(getattr(self,'server',None),'exiting',False): raise UserError('Ctrl Ur Finances is closing. Reopen it using your desktop shortcut.',409)
            if route=='/api/backup/retention/cancel': return self.respond(backup_retention.cancel_scan())
            if backup_retention.scanning(): raise UserError('Folder scan in progress. Wait or cancel the scan before saving changes.',409)
            if recovery.running(): raise UserError('Backup operation in progress. Wait for completion before saving changes.',409)
            if route=='/api/app/exit':
                self.server.exiting=True
                try:
                    self.respond({'stopping':True})
                    self.wfile.flush()
                finally:
                    threading.Thread(target=self.server.shutdown,daemon=True).start()
                return
            if route=='/api/move-planner': return self.respond(move_planner.save(sys.modules[__name__],body))
            if route=='/api/backup/retention/preview': return self.respond(backup_retention.start_preview(sys.modules[__name__]))
            if route=='/api/backup/retention': return self.respond(backup_retention.configure(sys.modules[__name__],body))
            if route=='/api/backup/check': return self.respond(recovery.start(sys.modules[__name__],body,check=True))
            if route=='/api/tool-layout': return self.respond(preferences.tools_layout(sys.modules[__name__],body.get('client'),body))
            if route=='/api/preferences': return self.respond(preferences.save(sys.modules[__name__],body))
            if route=='/api/setup': return self.respond(preferences.setup(sys.modules[__name__],body))
            if route=='/api/pick-data-directory':
                try:
                    import tkinter as tk
                    from tkinter import filedialog
                    win=tk.Tk();win.withdraw();win.attributes('-topmost',True)
                    try:chosen=filedialog.askdirectory(title='Choose an empty data folder')
                    finally:win.destroy()
                    file_access.remember('setup',chosen)
                    return self.respond({'path':chosen})
                except Exception:raise UserError('Folder picker unavailable. Use the default User-Data folder, or reopen the app and try the chooser again.')
            if route in ('/api/link','/api/unlink','/api/create','/api/loan/link','/api/loan/create'):
                validate_link_change(load_config(),route,body)
            if route=='/api/loan/create':
                cfg=load_config()
                if cfg.get('loan'):raise UserError('A family repayment workbook is already linked.',409)
                data=base64.b64decode(body.get('base64',''),validate=True);validate_xlsx(data);path=DATA/'Family-Repayment.xlsx'
                if path.exists():raise UserError('A family repayment workbook already exists. Link it instead.')
                atomic_file(path,data,backup=False)
                try:cfg['loan']={'path':stored_path(path)};persist_config(cfg)
                except Exception:path.unlink();raise
                return self.respond(pack_loan())
            if route=='/api/inspection/save': return self.respond(inspection_store.save(sys.modules[__name__],body))
            if route=='/api/backup/choose': return self.respond(recovery.choose(sys.modules[__name__],body))
            if route=='/api/backup/create': return self.respond(recovery.start(sys.modules[__name__],body))
            if route=='/api/backup/preview': return self.respond(recovery.preview(body,sys.modules[__name__]))
            if route=='/api/backup/restore': return self.respond(recovery.restore(sys.modules[__name__],body))
            if route=='/api/rearview': return self.respond(rearview.save(sys.modules[__name__],body))
            if route=='/api/debts': return self.respond(debts.save(sys.modules[__name__],body))
            if route=='/api/deadlines': return self.respond(deadlines.update(sys.modules[__name__],body))
            if route=='/api/editions':
                settings=body.get('settings')
                validate_editions(settings)
                config=load_config()
                if body.get('previous')!=config.get('editions'): raise UserError('Editions changed in another window. Your draft is still here. Reopen the app in another tab to check the latest saved editions before retrying.',409)
                config['editions']=settings
                persist_config(config)
                return self.respond({'editions':settings})
            if route=='/api/reporting':
                settings=body.get('settings')
                if not isinstance(settings,dict) or set(settings)-{'aliases','reconciled','inspectionProgress','incomeDisplay','businessDefaults','taxGroups','rvGroups','taxReviews','taxOverrides','taxNotes','reviewSnapshots','savedDestinations','dealerVisitReviews'}: raise UserError('Invalid reporting preferences.')
                for field in ['aliases','reconciled','taxGroups','rvGroups','taxOverrides']:
                    value=settings.get(field,{})
                    if not isinstance(value,dict) or len(value)>10000 or any(not isinstance(k,str) or len(k)>500 or not isinstance(v,str) or not 1<=len(v)<=100 for k,v in value.items()): raise UserError('Invalid reporting groups or month markers.')
                inspection_store.validate_dealer_reviews(sys.modules[__name__],settings.get('dealerVisitReviews',{}))
                snapshots=settings.get('reviewSnapshots',{})
                if not isinstance(snapshots,dict) or len(snapshots)>2400 or len(json.dumps(snapshots))>12000000: raise UserError('Invalid or oversized review history.')
                for key,snap in snapshots.items():
                    if not isinstance(key,str) or len(key)>100 or not isinstance(snap,dict) or snap.get('version')!=1 or not isinstance(snap.get('fingerprint'),str) or len(snap['fingerprint'])>100 or not isinstance(snap.get('reviewedAt'),str) or len(snap['reviewedAt'])>100 or not isinstance(snap.get('rows'),list) or len(snap['rows'])>12000: raise UserError('Invalid review snapshot.')
                    for row in snap['rows']:
                        if not isinstance(row,dict) or not isinstance(row.get('id'),str) or row.get('type') not in ['entry','transfer'] or not isinstance(row.get('notes'),list): raise UserError('Invalid review snapshot entry.')
                tax_notes=settings.get('taxNotes',{})
                if not isinstance(tax_notes,dict) or len(tax_notes)>10000: raise UserError('Invalid tax treatment notes.')
                for key,value in tax_notes.items():
                    if not isinstance(key,str) or len(key)>500 or not isinstance(value,dict) or set(value)-{'title','decision','reason','sources','reviewedDate'}: raise UserError('Invalid tax treatment note.')
                    for field,limit in [('title',500),('decision',2000),('reason',4000),('sources',4000),('reviewedDate',10)]:
                        if not isinstance(value.get(field,''),str) or len(value.get(field,''))>limit: raise UserError('Tax treatment note is too long or invalid.')
                    if value.get('reviewedDate'):
                        try: dt.date.fromisoformat(value['reviewedDate'])
                        except (ValueError,TypeError): raise UserError('Invalid treatment review date.')
                reviews=settings.get('taxReviews',{})
                if not isinstance(reviews,dict) or len(reviews)>10000: raise UserError('Invalid tax grouping reviews.')
                for key,value in reviews.items():
                    if not isinstance(key,str) or len(key)>500 or not isinstance(value,dict) or set(value)!={'reviewedAt','fingerprint'}: raise UserError('Invalid tax grouping review.')
                    if not isinstance(value['reviewedAt'],str) or not 10<=len(value['reviewedAt'])<=40: raise UserError('Invalid tax review date.')
                    if not isinstance(value['fingerprint'],str) or len(value['fingerprint'])!=64 or any(c not in '0123456789abcdef' for c in value['fingerprint']): raise UserError('Invalid tax review fingerprint.')
                inspection_store.validate_destinations(sys.modules[__name__],settings.get('savedDestinations',[]))
                defaults=settings.get('businessDefaults',{})
                if not isinstance(defaults,dict) or set(defaults)-{'reportingSoftware','processor','bankAccount'} or any(not isinstance(v,str) or len(v)>(200 if k=='bankAccount' else 100) for k,v in defaults.items()): raise UserError('Invalid business defaults.')
                display=settings.get('incomeDisplay',{})
                if not isinstance(display,dict) or len(display)>1500: raise UserError('Invalid income display settings.')
                for key,value in display.items():
                    if not isinstance(key,str) or len(key)>20 or not isinstance(value,dict) or set(value)-{'mode','order'} or value.get('mode') not in ('asc','desc','custom'): raise UserError('Invalid income display order.')
                    order=value.get('order',[])
                    if not isinstance(order,list) or len(order)>10000 or any(not isinstance(x,str) or len(x)>500 for x in order) or len(set(order))!=len(order): raise UserError('Invalid income entry order.')
                progress=settings.get('inspectionProgress',{})
                if not isinstance(progress,dict) or len(progress)>1200: raise UserError('Invalid inspection progress.')
                for key,value in progress.items():
                    if not isinstance(key,str) or len(key)!=7 or key[4]!='-' or not key[:4].isdigit() or not key[5:].isdigit() or not 1<=int(key[5:])<=12 or not isinstance(value,dict) or set(value)-{'reviewedAt','fingerprint','awaiting'}: raise UserError('Invalid inspection review marker.')
                    if 'reviewedAt' in value and (not isinstance(value['reviewedAt'],str) or not 10<=len(value['reviewedAt'])<=40): raise UserError('Invalid review date.')
                    if 'fingerprint' in value and (not isinstance(value['fingerprint'],str) or len(value['fingerprint'])!=64 or any(c not in '0123456789abcdef' for c in value['fingerprint'])): raise UserError('Invalid review fingerprint.')
                    waiting=value.get('awaiting',{})
                    if not isinstance(waiting,dict) or len(waiting)>10000: raise UserError('Invalid awaiting deposits.')
                    for event,item in waiting.items():
                        if not isinstance(event,str) or len(event)>500 or not isinstance(item,dict) or set(item)-{'note','markedAt'} or not isinstance(item.get('note'),str) or not 1<=len(item['note'].strip())<=500 or not isinstance(item.get('markedAt'),str) or not 10<=len(item['markedAt'])<=40: raise UserError('Add a brief explanation for each awaiting deposit.')
                config=load_config()
                if body.get('previous')!=config.get('reporting',{}): raise UserError('Reporting preferences changed in another window. Refresh before saving again.',409)
                config['reporting']=settings;persist_config(config)
                return self.respond({'reporting':settings})
            if route in ('/api/navigation','/api/tools-navigation'):
                order_key='toolsOrder' if route=='/api/tools-navigation' else 'navigationOrder'
                order=body.get('order')
                if not isinstance(order,list) or not 1<=len(order)<=40 or any(not isinstance(k,str) or not k.isascii() or not k.replace('_','').isalnum() or len(k)>50 for k in order) or len(set(order))!=len(order):
                    raise UserError('Choose a valid navigation order.')
                config=load_config()
                if body.get('previousOrder')!=config.get(order_key,[]):
                    raise UserError('Navigation changed in another window. Refresh the app before arranging it again.',409)
                if order_key=='navigationOrder' and 'toolsOrder' not in config:
                    config['toolsOrder']=[k for k in config.get('navigationOrder',[]) if k in ('recurring','bank','summary','compare','notes','links')]
                config[order_key]=order;persist_config(config)
                return self.respond({order_key:order,'toolsOrder':config.get('toolsOrder',[])})
            if route=='/api/pick': return self.respond({'path':picker()})
            if route=='/api/preview':
                p=file_access.workbook(sys.modules[__name__],body.get('path',''))
                if p.suffix.lower()!='.xlsx' or not p.is_file(): raise UserError('Choose an existing .xlsx file.')
                data=p.read_bytes();validate_xlsx(data)
                return self.respond({'path':str(p),'base64':base64.b64encode(data).decode(),'name':p.name,'revision':digest(data)})
            if route=='/api/loan/save': return self.respond(save_loan(body))
            if route=='/api/loan/link':
                p=file_access.workbook(sys.modules[__name__],body.get('path',''))
                if p.suffix.lower()!='.xlsx' or not p.is_file(): raise UserError('Choose an existing loan .xlsx workbook.')
                data=p.read_bytes();validate_xlsx(data)
                if body.get('previewRevision') and body['previewRevision']!=digest(data): raise UserError('The selected workbook changed after preview. Preview it again.',409)
                config=load_config()
                if any(os.path.normcase(str(resolve_path(item['path']).resolve()))==os.path.normcase(str(p)) for item in config['years'].values()): raise UserError('The loan must use its own workbook, separate from yearly expenses.')
                config['loan']={'path':stored_path(p)};persist_config(config);return self.respond(pack_loan())
            year=int(body.get('year',0))
            if year<1900 or year>2200: raise UserError('Enter a calendar year between 1900 and 2200.')
            if route=='/api/save': return self.respond(save_year(year,body))
            config=load_config()
            if route=='/api/link':
                p=file_access.workbook(sys.modules[__name__],body.get('path',''))
                if p.suffix.lower()!='.xlsx' or not p.is_file(): raise UserError('Choose an existing .xlsx file.')
                validate_xlsx(p.read_bytes())
                if config.get('loan') and os.path.normcase(str(resolve_path(config['loan']['path']).resolve()))==os.path.normcase(str(p)): raise UserError('This workbook is linked as the loan ledger. Choose a separate yearly expense workbook.')
                for y,item in config['years'].items():
                    if y!=str(year) and os.path.normcase(str(resolve_path(item['path']).resolve()))==os.path.normcase(str(p)): raise UserError('This workbook is already linked to '+y+'. Each year needs its own file.')
                config['years'][str(year)]={'path':stored_path(p),'test':False};persist_config(config);return self.respond(pack_year(year))
            if route=='/api/unlink':
                config['years'].pop(str(year),None);persist_config(config);return self.respond({'unlinked':True})
            if route=='/api/create':
                check_setup_source(year,body)
                if str(year) in config['years']: raise UserError('This year already has a linked workbook. Unlink it first if you intend to replace it.')
                p=DATA/'Workbooks'/f'{year}-Expense-Book.xlsx'
                if p.exists(): raise UserError('A workbook with that filename already exists. Link the existing file instead; it has not been overwritten.')
                data=base64.b64decode(body.get('base64',''),validate=True);validate_xlsx(data);atomic_file(p,data,backup=False)
                config['years'][str(year)]={'path':stored_path(p),'test':False};persist_config(config);return self.respond(pack_year(year))
            raise UserError('Unknown action.',404)
        except UserError as e: self.respond({'error':str(e)},e.status)
        except Exception as e: self.respond({'error':'The action did not complete: '+str(e)},500)

def existing_session(no_browser=False):
    """Only reopen a verified local process, never another PC's localhost URL."""
    try:
        session=json.loads((ROOT/'running-session.json').read_text())
        if session.get('computer')!=socket.gethostname():
            raise UserError('Ctrl Ur Finances is already running on another computer. Use Exit Ctrl Ur Finances on that computer before opening it here.')
        address=session['address'];parsed=urlsplit(address)
        if parsed.scheme!='http' or parsed.hostname!='127.0.0.1' or not parsed.port or parsed.path!='/': raise ValueError('Invalid session address')
        # Do not send local app probes through system proxies.
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(address+'app-instance',timeout=3) as response:
            identity=json.load(response)
        if not secrets.compare_digest(identity.get('instance',''),session.get('instance','')): raise ValueError('Different local process')
        if not no_browser: webbrowser.open(address)
        return
    except UserError: raise
    except Exception as exc:
        raise UserError('Ctrl Ur Finances is already running or still starting. Wait a few seconds and try again. If it is open on either computer, use its existing browser tab and Exit Ctrl Ur Finances before switching computers or updating. Do not delete the lock file.') from exc

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--no-browser',action='store_true');parser.add_argument('--port',type=int,default=0);args=parser.parse_args()
    # Preserve the existing shared-folder single-writer lock.
    lockfile=open(ROOT/'app-instance.lock','a+b')
    try:
        if os.name=='nt':
            import msvcrt
            if lockfile.seek(0,2)==0: lockfile.write(b'0');lockfile.flush()
            lockfile.seek(0);msvcrt.locking(lockfile.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(lockfile,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except OSError:
        lockfile.close()
        return existing_session(args.no_browser)
    server=None
    try:
        inspection_store.recover(sys.modules[__name__])
        server=HTTPServer(('127.0.0.1',args.port),Handler);address=f'http://127.0.0.1:{server.server_port}/'
        (ROOT/'running-address.txt').write_text(address)
        (ROOT/'running-session.json').write_text(json.dumps({'address':address,'computer':socket.gethostname(),'instance':INSTANCE}))
        print('Ctrl Ur Finances v3.32.53-alpha.4\n'+address+'\nUse Exit Ctrl Ur Finances in the sidebar before updating. Closing a browser tab does not stop the app.',flush=True)
        if not args.no_browser: threading.Timer(.5,lambda:webbrowser.open(address)).start()
        try: server.serve_forever()
        except KeyboardInterrupt: print('Ctrl Ur Finances stopped.')
    finally:
        if server: server.server_close()
        for name in ('running-session.json','running-address.txt'):
            try: (ROOT/name).unlink(missing_ok=True)
            except OSError: pass
        lockfile.close()
if __name__=='__main__': main()
