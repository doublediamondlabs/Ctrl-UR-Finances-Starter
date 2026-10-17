"""Verified local ZIP snapshots and isolated restores. No live workbook mutation."""
import threading, time
import re, copy, datetime as dt, hashlib, json, os, shutil, tempfile, uuid, zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET

EXCLUDE={'node_modules','.git','__pycache__','app-instance.lock','running-address.txt','running-session.json','Recovery-Backups','Restore-Reviews','backup-status.json','backup-cleanup-history.json'}
MANIFEST='DD-BACKUP.json'

_JOB_LOCK=threading.RLock()
_JOB={}
_LOCAL=threading.local()
def report(**values):
    if getattr(_LOCAL,'active',False):
        with _JOB_LOCK: _JOB.update(values,updatedAt=stamp())
def progress():
    with _JOB_LOCK:
        result=copy.deepcopy(_JOB)
        if result: result['elapsedSeconds']=round((result.get('ended',time.monotonic())-result['clock']),1);result.pop('clock',None);result.pop('ended',None)
        return result
def running():
    with _JOB_LOCK: return _JOB.get('state')=='running'
def start(app,body,check=False):
    with _JOB_LOCK:
        if running(): raise ValueError('A backup operation is already running.')
        _JOB.clear();_JOB.update(state='running',phase='Preparing',startedAt=stamp(),clock=time.monotonic(),done=0,total=0,current='',bytes=0)
    def work():
        _LOCAL.active=True
        try:
            result=status(app) if check else create(app,body)
            with _JOB_LOCK: _JOB.update(state='complete',phase='Finished',result=result,ended=time.monotonic())
        except Exception as exc:
            with _JOB_LOCK: _JOB.update(state='failed',phase='Stopped',error=str(exc),ended=time.monotonic())
        finally: _LOCAL.active=False
    threading.Thread(target=work,name='verified-backup',daemon=True).start()
    return progress()
def phase(name,total=0): report(phase=name,done=0,total=total,current='',bytes=0)
def hashes(sources,label):
    phase(label,len(sources));out={}
    for i,p in enumerate(sources):
        report(current=sources[p],done=i,bytes=0);out[p]=sha(p);report(done=i+1)
    return out

def stamp(): return dt.datetime.now().astimezone().isoformat(timespec='seconds')
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):
            h.update(b);report(bytes=f.tell())
    return h.hexdigest()
def inside(p,parent): return p.resolve().is_relative_to(parent.resolve())
def files(root,skip_updates=False):
    root=Path(root)
    if root.is_symlink() or getattr(root,'is_junction',lambda:False)(): raise ValueError('Linked folders are not supported: '+str(root))
    for p in sorted(root.iterdir()):
        report(current=str(p))
        if (skip_updates and p.name=='App-Update-Backups') or p.name in EXCLUDE or p.name.startswith(('.expense-book-','.dd-backup-','~$')): continue
        if p.is_symlink() or getattr(p,'is_junction',lambda:False)(): raise ValueError('Linked folders/files are not supported: '+str(p))
        if p.is_dir(): yield from files(p)
        elif p.is_file(): yield p

def inventory(app,reference='',include_updates=True):
    phase('Finding files')
    root=app.ROOT.resolve(); cfg=app.load_config(); result={str(p.resolve()):p.relative_to(root).as_posix() for p in files(root,skip_updates=not include_updates)}
    if not inside(app.DATA,root) and app.DATA.exists():
        for p in files(app.DATA,skip_updates=not include_updates):result[str(p.resolve())]='User-Data/'+p.relative_to(app.DATA).as_posix()
    links=[]
    for label,item in [(str(y),v) for y,v in cfg.get('years',{}).items()]+([('Family loan',cfg['loan'])] if cfg.get('loan') else []):
        source=app.resolve_path(item['path']).resolve()
        if not source.is_file(): raise ValueError('Linked workbook unavailable: '+str(source))
        app.ensure_unlocked(source);app.validate_xlsx(source.read_bytes())
        dest=result.get(str(source)) or 'Linked-Data/'+('Loan' if label=='Family loan' else 'Year-'+label)+'/'+source.name
        result[str(source)]=dest
        history=source.parent/'Expense-Book-Backups'/source.stem
        if history.is_dir() and not inside(history,root):
            for p in files(history): result[str(p.resolve())]=str(PurePosixPath(dest).parent/'Expense-Book-Backups'/source.stem/p.relative_to(history).as_posix())
        links.append({'label':label,'original':str(source),'stored':dest})
    if reference:
        refs=Path(reference).expanduser().resolve()
        if not refs.is_dir(): raise ValueError('Reference folder is unavailable.')
        if inside(root,refs): raise ValueError('Choose a specific reference folder, not a folder containing the app.')
        if not inside(refs,root):
            for p in files(refs): result.setdefault(str(p.resolve()),'References/'+p.relative_to(refs).as_posix())
    return cfg,result,links

def counts(path):
    ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as z:
        rels={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        out={}
        for s in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',ns):
            if s.attrib['name'] not in ('DD Index','DD Loan','DD Transfers','DD Visits','DD Income'): continue
            target=rels[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
            rows=ET.fromstring(z.read(target)).findall('m:sheetData/m:row',ns)
            out[s.attrib['name']]=max(0,len(rows)-1)
        return out

def create(app,body):
    started=stamp();include_updates=body.get('includeUpdateArchives',True) is not False
    root=app.ROOT.resolve(); default=app.DATA/'Recovery-Backups'
    parent=Path(body.get('destination') or default).expanduser().resolve()
    if (inside(parent,root) or inside(parent,app.DATA)) and parent!=default: raise ValueError('Use the default Recovery-Backups folder or a folder outside the app and data folders.')
    reference=str(body.get('reference') or '').strip()
    if reference and inside(parent,Path(reference)): raise ValueError('Backup destination must be outside the reference folder.')
    cfg,sources,links=inventory(app,reference,include_updates)
    if any(inside(Path(s),parent) for s in sources): raise ValueError('Destination contains source files. Choose a separate backup folder.')
    parent.mkdir(parents=True,exist_ok=True)
    original_config=copy.deepcopy(cfg); before=hashes(sources,'Reading source files')
    for link in links:
        item=cfg['loan'] if link['label']=='Family loan' else cfg['years'][link['label']]
        item['path']=link['stored']
    cfgbytes=json.dumps(cfg,indent=2).encode()
    manifest={'format':'double-diamond-backup-1','version':(re.search(r'Expense Book ([0-9.]+(?:-alpha\.[0-9]+)?)',app.__doc__ or '').group(1) if re.search(r'Expense Book ([0-9.]+(?:-alpha\.[0-9]+)?)',app.__doc__ or '') else 'Unknown'),'created':started,'includeUpdateArchives':include_updates,'files':{},'links':links,'reference':reference,'excluded':sorted(EXCLUDE)}
    fd,tmp=tempfile.mkstemp(prefix='.dd-backup-',suffix='.zip',dir=parent);os.close(fd)
    final=parent/('Double-Diamond-Backup-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.zip')
    try:
        phase('Writing backup ZIP',len(sources))
        with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,allowZip64=True) as z:
            config_dest=sources[str(app.CONFIG.resolve())]
            for i,(source,dest) in enumerate(sources.items()):
                report(current=dest,done=i,bytes=0)
                if source==str(app.CONFIG.resolve()) or dest=='data-location.json': continue
                with open(source,'rb') as src,z.open('App/'+dest,'w',force_zip64=True) as dst:
                    copied=0
                    for b in iter(lambda:src.read(1024*1024),b''):
                        dst.write(b);copied+=len(b);report(bytes=copied)
                manifest['files']['App/'+dest]=before[source];report(done=i+1)
            z.writestr('App/'+config_dest,cfgbytes);manifest['files']['App/'+config_dest]=hashlib.sha256(cfgbytes).hexdigest()
            pointer=json.dumps({'path':str(PurePosixPath(config_dest).parent)}).encode();z.writestr('App/data-location.json',pointer);manifest['files']['App/data-location.json']=hashlib.sha256(pointer).hexdigest()
            for link in links: link['counts']=counts(link['original'])
            z.writestr(MANIFEST,json.dumps(manifest,indent=2))
        inspect(tmp)
        cfg2,sources2,_=inventory(app,reference,include_updates)
        if cfg2!=original_config or sources2!=sources or hashes(sources,'Checking source files stayed unchanged')!=before: raise ValueError('Files changed while backing up. Close other editors and retry.')
        phase('Finalizing verified backup');report(current=final.name)
        archive_hash=sha(tmp)
        os.replace(tmp,final)
        record={'created':manifest['created'],'path':str(final),'completedAt':stamp(),'archiveHash':archive_hash,'sources':before,'reference':reference,'includeUpdateArchives':include_updates}
        app.atomic_file(app.DATA/'backup-status.json',json.dumps(record,indent=2).encode(),backup=False)
        # Cleanup metadata failures must never lose the successful ZIP or deletion accounting.
        import backup_retention
        try:
            removed=backup_retention.clean(app,record)
            if removed:
                record['sources']={p:h for p,h in before.items() if p not in set(removed)}
                record['retentionRemoved']=removed
            backup_retention.save_metadata(app,app.DATA/'backup-status.json',record)
            result=status(app) if removed else record_status(app,record,verified=True)
            return result
        except Exception as exc:
            result=record_status(app,record,verified=False)
            result['cleanupWarning']='Backup saved. Automatic cleanup or its status update stopped: '+str(exc)
            return result
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def record_status(app,record,verified=False):
    result={k:record.get(k) for k in ('created','completedAt','path','reference','includeUpdateArchives','cleanupWarning','cleanupSummary')}
    result.update(defaultDestination=str(app.DATA/'Recovery-Backups'),destination=str(Path(record['path']).parent))
    return dict(result,state='green' if verified else 'neutral',label='Backup matches current files' if verified else 'Backup recorded · current files not rechecked',checked=stamp() if verified else None)

def status(app,verify=True):
    path=app.DATA/'backup-status.json'; checked=stamp()
    if not path.exists(): return {'state':'neutral','label':'No backup recorded through Backup & Recovery','checked':checked,'defaultDestination':str(app.DATA/'Recovery-Backups')}
    try: record=json.loads(path.read_text())
    except Exception: return {'state':'red','label':'Backup record unreadable','checked':checked}
    result=record_status(app,record)
    if not verify: return result
    result['checked']=checked
    if not Path(record['path']).is_file(): return dict(result,state='red',label='Backup file unavailable')
    try:
        _,current,_=inventory(app,record.get('reference',''),record.get('includeUpdateArchives',True))
        changed=set(current)!=set(record['sources']) or hashes(current,'Comparing current files')!=record['sources']
        phase('Verifying saved ZIP');report(current=Path(record['path']).name)
        if sha(record['path'])!=record['archiveHash']: return dict(result,state='red',label='Backup file changed — create a new backup')
        return dict(result,state='amber' if changed else 'green',label='Changes since backup' if changed else 'Backup matches current files')
    except Exception as e: return dict(result,state='red',label='Cannot verify current files',detail=str(e))

def safe_name(name):
    p=PurePosixPath(name)
    return name==p.as_posix() and not p.is_absolute() and all(v not in ('','..','.') and ':' not in v and '\\' not in v and not v.endswith((' ','.')) and v.split('.')[0].upper() not in {'CON','PRN','AUX','NUL',*[f'COM{i}' for i in range(1,10)],*[f'LPT{i}' for i in range(1,10)]} for v in p.parts)

def inspect(path):
    with zipfile.ZipFile(path) as z:
        infos=z.infolist();names=[i.filename for i in infos]
        if len(names)>100000 or len({n.casefold() for n in names})!=len(names) or any(not safe_name(n) or (i.external_attr>>16)&0o170000==0o120000 for n,i in zip(names,infos)): raise ValueError('Unsafe or duplicate ZIP paths.')
        if sum(i.file_size for i in infos)>20*1024**3: raise ValueError('Backup exceeds the 20 GB recovery limit.')
        if MANIFEST not in names or z.getinfo(MANIFEST).file_size>20*1024**2: raise ValueError('Choose a backup created by Back up everything now.')
        m=json.loads(z.read(MANIFEST))
        if m.get('format')!='double-diamond-backup-1' or not isinstance(m.get('files'),dict): raise ValueError('Unsupported backup format.')
        if set(names)!={MANIFEST,*m['files']} or any(not n.startswith('App/') for n in m['files']): raise ValueError('Backup contents do not match its manifest.')
        config_name='App/linked-workbooks.json'
        if 'App/data-location.json' in names:
            relative=json.loads(z.read('App/data-location.json')).get('path','')
            if relative!='.' and not safe_name(relative):raise ValueError('Backup has an unsafe data folder pointer.')
            config_name=str(PurePosixPath('App')/relative/'linked-workbooks.json')
        if not {'App/Start-App.bat','App/expense_book.py',config_name}<=set(names): raise ValueError('Backup is missing application files.')
        phase('Verifying ZIP contents',len(m['files']))
        for i,(n,expected) in enumerate(m['files'].items()):
            report(current=n,done=i,bytes=0)
            h=hashlib.sha256()
            with z.open(n) as f:
                for b in iter(lambda:f.read(1024*1024),b''):
                    h.update(b);report(bytes=f.tell())
            report(done=i+1)
            if h.hexdigest()!=expected: raise ValueError('Backup verification failed: '+n)
        cfg=json.loads(z.read(config_name))
        for item in [*cfg.get('years',{}).values(),*([cfg['loan']] if cfg.get('loan') else [])]:
            name=item.get('path','')
            if not safe_name(name) or 'App/'+name not in m['files']: raise ValueError('Backup contains an external or missing workbook link.')
        return m

def preview(body):
    p=Path(str(body.get('path','')).strip().strip('"')).expanduser().resolve()
    if not p.is_file() or p.suffix.lower()!='.zip': raise ValueError('Enter the full path to a backup ZIP.')
    before=sha(p);m=inspect(p)
    if before!=sha(p): raise ValueError('Backup changed during verification. Preview again.')
    return {'path':str(p),'revision':before,'created':m['created'],'version':m['version'],'links':m['links'],'fileCount':len(m['files']),'reference':m.get('reference','')}

def restore(app,body):
    p=Path(str(body.get('path','')).strip().strip('"')).resolve()
    # Copy first: preview guard and extraction operate on the same immutable local snapshot.
    parent=app.DATA/'Restore-Reviews';parent.mkdir(exist_ok=True)
    stage=Path(tempfile.mkdtemp(prefix='.dd-backup-',dir=parent))
    try:
        archive=stage/'input.zip';shutil.copyfile(p,archive)
        if sha(archive)!=body.get('revision'): raise ValueError('Backup changed since preview. Preview it again.')
        inspect(archive)
        with zipfile.ZipFile(archive) as z:
            for info in z.infolist():
                if info.filename==MANIFEST: continue
                target=stage/info.filename;target.parent.mkdir(parents=True,exist_ok=True)
                with z.open(info) as src,open(target,'xb') as dst:shutil.copyfileobj(src,dst)
        final=parent/('Review-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'-'+uuid.uuid4().hex[:6])
        (stage/'App').rename(final)
        return {'folder':str(final),'message':'Restored into a separate review folder. Current files and links were not changed. Close the current app before opening the restored copy; use only one working copy going forward.'}
    finally:shutil.rmtree(stage,ignore_errors=True)


def choose(app,body):
    kind=body.get('kind')
    if kind not in ('destination','reference','archive'): raise ValueError('Unknown backup chooser.')
    initial=str(body.get('initial') or '').strip().strip('"')
    start=Path(initial).expanduser() if initial else app.ROOT
    if not start.is_dir(): start=start.parent
    if not start.is_dir(): start=app.ROOT
    try:
        import tkinter as tk
        from tkinter import filedialog
        root=tk.Tk();root.withdraw();root.attributes('-topmost',True)
        try:
            if kind=='archive':
                selected=filedialog.askopenfilename(parent=root,title='Choose a recovery backup ZIP',initialdir=str(start),filetypes=[('Recovery backup ZIP','*.zip')])
            else:
                selected=filedialog.askdirectory(parent=root,title='Choose backup destination folder' if kind=='destination' else 'Choose external reference folder',initialdir=str(start),mustexist=True)
            return {'path':selected or ''}
        finally: root.destroy()
    except Exception as exc:
        raise ValueError('The chooser could not open. You can still paste a full path into the field.') from exc
