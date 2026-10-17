"""Conservative retention for recognized backup histories after a verified snapshot."""
import calendar, datetime as dt, json, re, shutil, os, threading, time, copy
from functools import lru_cache
from pathlib import Path

SETTINGS='backup-retention.json'
HISTORY='backup-cleanup-history.json'
STAMP=r'\d{8}-\d{6}-\d{6}'

def read(app):
    p=app.DATA/SETTINGS
    settings=json.loads(p.read_text()) if p.exists() else {'enabled':False}
    h=app.DATA/HISTORY
    history=json.loads(h.read_text()) if h.exists() else []
    # A backup-status summary is a fallback when the separate history file was locked.
    try:
        summary=json.loads((app.DATA/'backup-status.json').read_text()).get('cleanupSummary')
        if isinstance(summary,dict) and summary.get('started'):
            matching=next((i for i,h in enumerate(history) if (h.get('id')==summary['id'] if summary.get('id') else h.get('started')==summary['started'])),None)
            if matching is not None:history[matching]={**history[matching],**summary}
            elif not history or (summary['started'],summary.get('id',''))>(history[0].get('started',''),history[0].get('id','')):history=[summary,*history][:100]
    except (OSError,ValueError,TypeError):pass
    return {'enabled':settings.get('enabled') is True,'history':history}

class MetadataWriteError(RuntimeError):pass

def access_denied(exc):
    seen=set()
    while exc is not None and id(exc) not in seen:
        seen.add(id(exc))
        if isinstance(exc,PermissionError) or (isinstance(exc,OSError) and (getattr(exc,'winerror',None) in (5,32,33) or exc.errno in (13,16))):return True
        exc=exc.__cause__ or exc.__context__
    return False

def save_metadata(app,path,data):
    """Retry only access/sharing errors, without changing permissions or deleting the log."""
    payload=json.dumps(data,indent=2).encode()
    delays=(0,.15,.35,.75,1.5)
    for attempt,delay in enumerate(delays):
        if delay:time.sleep(delay)
        try:
            app.atomic_file(path,payload,backup=False)
            return
        except Exception as exc:
            if not access_denied(exc) or attempt==len(delays)-1:
                reason='Windows denied access after several attempts' if access_denied(exc) else str(exc)
                raise MetadataWriteError(f'Could not save backup metadata ({path.name}): {reason}. The verified backup ZIP is unchanged. Check access to the backup folder before trying another full backup.') from exc

def write(app,name,data):
    save_metadata(app,app.DATA/name,data)

def configure(app,body):
    if type(body.get('enabled')) is not bool: raise ValueError('Choose On or Off.')
    if body['enabled'] and body.get('reviewed') is not True: raise ValueError('Review the folder summary before enabling retention.')
    write(app,SETTINGS,{'enabled':body['enabled']})
    return read(app)

def linked(p):
    return p.is_symlink() or getattr(p,'is_junction',lambda:False)()

def safe_path(p):
    return not any(linked(x) for x in [p,*p.parents])

def timestamp(name):
    m=re.search(STAMP,name)
    if not m:return None
    try:return dt.datetime.strptime(m.group(),'%Y%m%d-%H%M%S-%f')
    except ValueError:return None

def month_floor(now):
    year=now.year-1
    return now.replace(year=year,day=min(now.day,calendar.monthrange(year,now.month)[1]))

def kept(entries,now,updates=False):
    ordered=sorted(entries,key=lambda e:e['date'],reverse=True)
    keep={e['path'] for e in ordered[:3 if updates else 10]}
    days=set();months=set()
    for e in ordered:
        date=e['date'];age=now-date
        if age<=dt.timedelta(days=7):keep.add(e['path'])
        if not updates:
            if age<=dt.timedelta(days=30) and date.date() not in days:
                keep.add(e['path']);days.add(date.date())
            if date>=month_floor(now) and (date.year,date.month) not in months:
                keep.add(e['path']);months.add((date.year,date.month))
    return keep

def groups(app,sources,progress=None):
    """Only canonical histories; reference folders and nested recovery copies are excluded."""
    root=app.ROOT.resolve();data=app.DATA.resolve(); cfg=app.load_config();workbook_folders=set()
    progress=progress or (lambda p:None)
    @lru_cache(maxsize=None)
    def safe(p):
        progress(p)
        return not linked(p) and (p.parent==p or safe(p.parent))
    for item in [*cfg.get('years',{}).values(),*([cfg['loan']] if cfg.get('loan') else [])]:
        p=app.resolve_path(item['path']).resolve()
        workbook_folders.add(p.parent/'Expense-Book-Backups'/p.stem)
    # Include archived/unlinked workbook histories inside the app, but not copied recovery sets.
    excluded={'App-Update-Backups','Inspection-History-Backups','Recovery-Backups','Restore-Reviews','Loan-Tracker-Backups','node_modules','.git','__pycache__'}
    if sources is None:
        # Discover directories only; do not open workbooks or inventory all app files.
        for scan_root in ([root,data] if not data.is_relative_to(root) else [root]):
            if not safe(scan_root):continue
            for base,dirs,_ in os.walk(scan_root,followlinks=False):
                parent=Path(base);progress(parent)
                dirs[:]=[n for n in dirs if n not in excluded and safe(parent/n)]
                if parent.name=='Expense-Book-Backups':
                    workbook_folders.update(parent/n for n in dirs);dirs[:]=[]
        source_names=[]
    else:source_names=sources
    for source in source_names:
        p=Path(source)
        base=root if p.is_relative_to(root) else data if p.is_relative_to(data) else None
        if base is not None and not excluded.intersection(p.relative_to(base).parts) and p.parent.parent.name=='Expense-Book-Backups':
            workbook_folders.add(p.parent)
    output=[]
    def collect(folder,kind):
        progress(folder)
        if not safe(folder) or not folder.is_dir():return
        entries=[]
        for p in folder.iterdir():
            progress(p)
            if not safe(p):continue
            name=p.name;date=timestamp(name)
            if date is None:continue
            if kind=='Workbook':valid=p.is_file() and re.fullmatch(STAMP+r'\.xlsx',name)
            elif kind=='Loan tracker':valid=p.is_file() and re.fullmatch(STAMP+r'\.json',name)
            elif kind=='Inspection history':valid=p.is_dir() and re.fullmatch(STAMP,name)
            else:valid=p.is_dir() and re.fullmatch(r'(?:before-update-to-v[0-9.]+-|before-starter-update-)'+STAMP,name) and (p/'PROGRAM-MANIFEST.json').is_file()
            if not valid:continue
            members=sorted(p.rglob('*')) if p.is_dir() else [p]
            if any(not safe(f) for f in members):continue
            members=[f for f in members if f.is_file()]
            if not members:continue
            if kind=='Inspection history' and any(f.parent!=p or not re.fullmatch(r'\d+-.+\.(xlsx|json)',f.name) for f in members):continue
            # Complete sets must be in this snapshot, including every nested member.
            if sources is not None and any(str(f) not in sources for f in members):continue
            entries.append({'path':str(p),'date':date,'files':[str(f) for f in members],'bytes':sum(f.stat().st_size for f in members)})
        if entries:output.append({'folder':str(folder),'kind':kind,'entries':entries})
    for folder in sorted(workbook_folders):collect(folder,'Workbook')
    collect(data/'Loan-Tracker-Backups','Loan tracker')
    collect(data/'Inspection-History-Backups','Inspection history')
    collect(root/'App-Update-Backups','Program update')
    return output

def plan(app,sources,now=None,progress=None):
    now=now or dt.datetime.now();result=[]
    if (app.DATA/'inspection-transaction.json').exists():return []
    for group in groups(app,sources,progress):
        keep=kept(group['entries'],now,group['kind']=='Program update')
        remove=[e for e in group['entries'] if e['path'] not in keep]
        result.append({**group,'remove':remove,'keepCount':len(keep)})
    return result

def preview(app,progress=None):
    rows=plan(app,None,progress=progress)
    return {'folders':[{'folder':g['folder'],'kind':g['kind'],'keep':g['keepCount'],'remove':len(g['remove']),'files':sum(len(e['files']) for e in g['remove']),'bytes':sum(e['bytes'] for e in g['remove'])} for g in rows], 'blocked':(app.DATA/'inspection-transaction.json').exists()}

def clean(app,record):
    """Return removed source paths. Failure never invalidates the verified ZIP."""
    import recovery
    state=read(app);now=dt.datetime.now();today=now.date().isoformat()
    if not state['enabled'] or any(h.get('day')==today and str(h.get('state','')).startswith('complete') for h in state['history']):return []
    if (app.DATA/'inspection-transaction.json').exists():return []
    # The archive was just verified by create(); keep checking identity during cleanup.
    archive=Path(record['path']);identity=archive.stat()
    sources=record['sources'];rows=plan(app,sources,now)
    entry={'id':str(time.time_ns()),'day':today,'started':recovery.stamp(),'backup':str(archive),'removed':[],'files':0,'bytes':0,'skipped':0,'state':'running'}
    history=[entry,*state['history']][:100]
    try:
        write(app,HISTORY,history)
        for group in rows:
            for candidate in group['remove']:
                p=Path(candidate['path'])
                try:
                    if archive.stat()!=identity or (app.DATA/'inspection-transaction.json').exists():raise ValueError('Recovery state changed; cleanup stopped.')
                    actual=sorted(str(f) for f in p.rglob('*') if f.is_file()) if p.is_dir() else [str(p)]
                    if actual!=sorted(candidate['files']) or not safe_path(p) or any(not safe_path(Path(f)) or recovery.sha(f)!=sources[f] for f in actual):
                        entry['skipped']+=1;continue
                    # Rename complete sets before removal, so a partial deletion is never offered as a recovery set.
                    if p.is_dir():
                        quarantine=p.with_name('.retention-removing-'+p.name)
                        if quarantine.exists():entry['skipped']+=1;continue
                        p.rename(quarantine)
                        entry['removed'].extend(actual)
                        write(app,HISTORY,history)
                        shutil.rmtree(quarantine)
                        entry['files']+=len(actual);entry['bytes']+=candidate['bytes']
                    else:
                        p.unlink();entry['removed'].extend(actual);entry['files']+=1;entry['bytes']+=candidate['bytes']
                    write(app,HISTORY,history)
                except (OSError,ValueError,KeyError) as exc:
                    entry['skipped']+=1;entry['detail']=str(exc)
                    if not archive.exists() or archive.stat()!=identity or (app.DATA/'inspection-transaction.json').exists():raise ValueError('Recovery state changed; cleanup stopped.')
        entry['state']='complete' if not entry['skipped'] else 'complete with skipped items'
    except Exception as exc:
        entry['state']='stopped';entry['detail']=str(exc)
    finally:
        entry['completed']=recovery.stamp()
        if entry['state']=='stopped':record['cleanupWarning']='Backup saved; cleanup stopped after removing '+str(entry['files'])+' files. '+entry.get('detail','')
        try:write(app,HISTORY,history)
        except Exception as exc:
            entry['state']='stopped';entry['detail']=str(exc)
            record['cleanupWarning']='Backup saved; cleanup history could not be updated after removing '+str(entry['files'])+' files. '+str(exc)
        # This summary travels with the backup status even if the history file is locked.
        record['cleanupSummary']={k:entry[k] for k in ('id','day','started','completed','state','files','bytes','skipped','backup')}
        if entry.get('detail'):record['cleanupSummary']['detail']=entry['detail']
    return entry['removed']


_SCAN_LOCK=threading.RLock()
_SCAN={}
_CANCEL=threading.Event()

def scanning():
    with _SCAN_LOCK:return _SCAN.get('state')=='running'

def scan_progress():
    with _SCAN_LOCK:
        result=copy.deepcopy(_SCAN)
        if result:
            result['elapsedSeconds']=round(result.get('ended',time.monotonic())-result['clock'])
            result.pop('clock',None);result.pop('ended',None)
        return result

def cancel_scan():
    _CANCEL.set()
    with _SCAN_LOCK:
        if scanning():_SCAN['cancelling']=True
    return scan_progress()

def start_preview(app):
    with _SCAN_LOCK:
        if scanning():return scan_progress()
        _CANCEL.clear();_SCAN.clear();_SCAN.update(id=str(time.time_ns()),state='running',clock=time.monotonic(),checked=0,current='',cancelling=False)
    def work():
        def progress(path):
            if _CANCEL.is_set():raise InterruptedError('Folder scan cancelled. No files were changed.')
            with _SCAN_LOCK:_SCAN.update(checked=_SCAN['checked']+1,current=str(path))
        try:
            result=preview(app,progress)
            progress(app.ROOT)
            with _SCAN_LOCK:_SCAN.update(state='complete',result=result,ended=time.monotonic())
        except InterruptedError as exc:
            with _SCAN_LOCK:_SCAN.update(state='cancelled',message=str(exc),ended=time.monotonic())
        except Exception as exc:
            with _SCAN_LOCK:_SCAN.update(state='failed',error=str(exc),ended=time.monotonic())
    threading.Thread(target=work,name='backup-retention-preview',daemon=True).start()
    return scan_progress()
