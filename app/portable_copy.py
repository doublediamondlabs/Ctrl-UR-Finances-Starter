"""Create an offline, self-contained copy. Originals are never moved or relinked."""
from pathlib import Path
import contextlib,datetime,json,os,shutil,tempfile,hashlib
import expense_book as app

EXCLUDE={'node_modules','.git','__pycache__','app-instance.lock','running-address.txt','running-session.json','Recovery-Backups','Restore-Reviews','backup-status.json'}
def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def inside(p,parent):
    try:p.resolve().relative_to(parent.resolve());return True
    except ValueError:return False

def copy_tree(source,target):
    source=Path(source);target=Path(target)
    if source.is_symlink() or getattr(source,'is_junction',lambda:False)():raise ValueError('Linked folders/files are not supported in the copy: '+str(source))
    target.mkdir(parents=True,exist_ok=True)
    for p in source.iterdir():
        if p.name in EXCLUDE or p.name.startswith('.expense-book-'):continue
        if p.is_symlink() or getattr(p,'is_junction',lambda:False)():raise ValueError('Linked folders/files are not supported in the copy: '+str(p))
        if p.is_dir():copy_tree(p,target/p.name)
        elif p.is_file():
            before=digest(p);shutil.copy2(p,target/p.name)
            if digest(target/p.name)!=before or digest(p)!=before:raise ValueError('A file changed during the copy. Close other editors and retry: '+str(p))

@contextlib.contextmanager
def app_lock(root):
    f=open(root/'app-instance.lock','a+b')
    try:
        if os.name=='nt':
            import msvcrt
            f.seek(0);f.write(b'0');f.flush();f.seek(0)
            try:msvcrt.locking(f.fileno(),msvcrt.LK_NBLCK,1)
            except OSError:raise ValueError('Use Exit Ctrl Ur Finances (or close the old Start-App command window) before copying.')
        else:
            import fcntl
            try:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except OSError:raise ValueError('Use Exit Ctrl Ur Finances (or close the old Start-App command window) before copying.')
        yield
    finally:f.close()

def create_copy(destination_parent,references=None):
    root=app.ROOT.resolve();parent=Path(destination_parent).resolve()
    if not parent.is_dir():raise ValueError('Choose an existing destination folder.')
    if inside(parent,root) or inside(parent,app.DATA):raise ValueError('Choose a destination outside the existing application and data folders.')
    refs=Path(references).resolve() if references else None
    if refs and (not refs.is_dir() or inside(parent,refs) or inside(root,refs)):
        raise ValueError('Choose a specific reference folder that does not contain the app or destination.')
    with app_lock(root):
        app.inspection_store.recover(app)
        original_config=app.CONFIG.read_bytes() if app.CONFIG.exists() else None
        config=app.load_config();items=[]
        for year,item in config.get('years',{}).items():
            if not str(year).isdigit():raise ValueError('Invalid year link; contact support.')
            items.append(('Year-'+str(year),item))
        if config.get('loan'):items.append(('Loan',config['loan']))
        if not items:raise ValueError('No workbooks are linked. Link your current workbooks before creating a portable copy.')
        sources=[]
        for name,item in items:
            source=app.resolve_path(item['path']).resolve()
            if not source.is_file():raise ValueError('Linked workbook is missing: '+str(source))
            app.ensure_unlocked(source);app.validate_xlsx(source.read_bytes());sources.append((name,item,source,digest(source)))
        stage=Path(tempfile.mkdtemp(prefix='.dd-portable-',dir=parent))
        try:
            target=stage/'Double-Diamond-Control-Panel'
            print('Copying app files and existing local history…',flush=True);copy_tree(root,target)
            if not inside(app.DATA,root):copy_tree(app.DATA,target/'User-Data')
            data_relative=app.DATA.relative_to(root) if inside(app.DATA,root) else Path('User-Data')
            # Preserve unlinked data too; only current linked paths are rewritten.
            data=target/'Portable-Data'
            for name,item,source,sha in sources:
                print('Copying linked workbook and backup history: '+name,flush=True)
                dst=data/name/source.name;dst.parent.mkdir(parents=True,exist_ok=True)
                if dst.exists() and digest(dst)!=sha:
                    dst.rename(dst.with_name(dst.stem+'-previous-copy-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+dst.suffix))
                shutil.copy2(source,dst)
                if digest(dst)!=sha:raise ValueError('Workbook copy verification failed: '+str(source))
                history=source.parent/'Expense-Book-Backups'/source.stem
                if history.is_dir():copy_tree(history,dst.parent/'Expense-Book-Backups'/dst.stem)
                item['path']=dst.relative_to(target).as_posix()
            if refs:
                print('Copying selected reference folder…',flush=True)
                refdest=target/'References'/'Included-Reference-Folder'
                if refdest.exists():refdest=refdest.with_name(refdest.name+'-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
                copy_tree(refs,refdest)
            (target/data_relative/'linked-workbooks.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
            (target/'data-location.json').write_text(json.dumps({'path':data_relative.as_posix()}),encoding='utf-8')
            for _,_,source,sha in sources:
                if digest(source)!=sha:raise ValueError('A linked workbook changed during copying; retry with Excel closed.')
            if (app.CONFIG.read_bytes() if app.CONFIG.exists() else None)!=original_config:raise ValueError('App settings changed during copying; please retry.')
            manifest={'created':datetime.datetime.now().isoformat(timespec='seconds'),'version':'3.32.53-alpha.3','files':{}}
            for p in sorted(target.rglob('*')):
                if p.is_file() and p.name!='PORTABLE-MANIFEST.json':manifest['files'][p.relative_to(target).as_posix()]=digest(p)
            (target/'PORTABLE-MANIFEST.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
            name='Double-Diamond-Control-Panel-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
            final=parent/name;target.rename(final)
            return final
        finally:
            shutil.rmtree(stage,ignore_errors=True)

def choose(title):
    try:
        import tkinter as tk
        from tkinter import filedialog
        win=tk.Tk();win.withdraw();win.attributes('-topmost',True)
        try:return filedialog.askdirectory(title=title)
        finally:win.destroy()
    except Exception:return input(title+' (paste folder path, or Enter to skip): ').strip().strip('"')

def main():
    print('Double Diamond — Create portable copy\nClose the app launcher and Excel first. Your originals will remain unchanged.\n')
    print('The copy includes this app folder, every linked yearly/loan workbook, workbook backup histories and your app settings.\nOptional: include the folder where you keep bank PDFs, CSVs and other references.\n')
    parent=choose('Choose where the NEW portable folder should be created')
    if not parent:print('Cancelled. Nothing changed.');return
    refs=choose('Optional: choose your bank/reference folder, or Cancel to skip')
    try:
        final=create_copy(parent,refs or None)
        print('\nPortable copy created and verified:\n'+str(final)+'\n\nKeep the entire folder together. Start it using Start-App.bat INSIDE that folder.\nThe original app still uses its original workbooks. Use only one copy going forward to avoid separate histories.\nSee PORTABLE-GUIDE.txt inside the new folder. No data was uploaded or deleted.')
    except Exception as e:print('\nCopy was not completed: '+str(e));raise SystemExit(1)
if __name__=='__main__':main()
