"""Windows launch convenience; application data remains in the existing folder."""
import argparse, ctypes, hashlib, os, runpy, shutil, subprocess, sys, traceback
from pathlib import Path

def message(text):
    if os.name == 'nt':
        ctypes.windll.user32.MessageBoxW(None, text, 'Ctrl Ur Finances', 0x10 | 0x10000)
    else:
        print(text, file=sys.stderr)

def log_path(root):
    base = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'CtrlUrFinances'
    base.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(str(root).casefold().encode()).hexdigest()[:12]
    return base / ('startup-' + key + '.log')

def explain(exc, root, log):
    if isinstance(exc, (FileNotFoundError, NotADirectoryError)):
        hint = 'The application folder or a required file is unavailable. Check your network connection and open the shared folder in File Explorer. Then try your shortcut again.'
    elif isinstance(exc, PermissionError):
        hint = 'Windows denied access to the application folder. Check that you can open and save files in the shared folder. Do not run the app as administrator to work around this.'
    else:
        hint = 'Ctrl Ur Finances could not start. If it is open elsewhere, use Exit Ctrl Ur Finances there before trying again.'
    return hint + '\n\nApplication: ' + str(root) + '\n\nDetails: ' + str(exc) + '\n\nStartup log: ' + str(log)

def install_shortcut(root):
    if os.name != 'nt':
        raise RuntimeError('Desktop shortcut installation is for Windows.')
    pythonw = Path(sys.executable).with_name('pythonw.exe')
    if not pythonw.is_file():
        raise FileNotFoundError('pythonw.exe was not found beside Python. Repair your Python installation, or continue using Start-App.bat.')
    local = log_path(root).parent
    key = hashlib.sha256(str(root).casefold().encode()).hexdigest()[:12]
    bootstrap = local / ('launch-' + key + '.pyw')
    icon_source = root / 'Ctrl-Ur-Finances.ico'
    icon = local / ('diamonds-' + hashlib.sha256(icon_source.read_bytes()).hexdigest()[:12] + '.ico')
    shutil.copyfile(icon_source, icon)
    # A local bootstrap can explain an inaccessible share before loading any app code.
    bootstrap.write_text('import ctypes, runpy, sys\nfrom pathlib import Path\nroot=Path(' + repr(str(root)) + ')\ntry:\n    launcher=root/"quiet_start.py"\n    if not launcher.is_file(): raise FileNotFoundError("The network share is unavailable, or the application folder has moved.")\n    sys.argv=[str(launcher),"--worker"]\n    runpy.run_path(str(launcher),run_name="__main__")\nexcept Exception as exc:\n    ctypes.windll.user32.MessageBoxW(None,"Ctrl Ur Finances could not start. Check your network connection and open the shared folder in File Explorer, then try again.\\n\\nFolder: "+str(root)+"\\n\\nDetails: "+str(exc),"Ctrl Ur Finances",0x10010)\n', encoding='utf-8')
    def literal(value): return "'" + str(value).replace("'", "''") + "'"
    command = "$ErrorActionPreference='Stop'; $w=New-Object -ComObject WScript.Shell; $p=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ctrl Ur Finances.lnk'; if((Test-Path $p) -and ($w.CreateShortcut($p).Arguments -ne " + literal('"' + str(bootstrap) + '"') + ")){$p=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ctrl Ur Finances - Quiet.lnk'}; $s=$w.CreateShortcut($p); $s.TargetPath=" + literal(pythonw) + "; $s.Arguments=" + literal('"' + str(bootstrap) + '"') + "; $s.WorkingDirectory=" + literal(local) + "; $s.IconLocation=" + literal(str(icon) + ",0") + "; $s.Description='Open your shared Ctrl Ur Finances without a command window'; $s.Save(); Write-Output $p"
    result = subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command], capture_output=True, text=True)
    if result.returncode: raise RuntimeError('The desktop shortcut could not be created. Your existing shortcut still works. ' + result.stderr.strip())
    print('Created desktop shortcut: ' + result.stdout.strip())
    print('Use the new shortcut. Your existing shortcut has not been removed.')

def worker(root):
    log = log_path(root)
    if log.exists() and log.stat().st_size > 1024 * 1024:
        log.replace(log.with_suffix('.previous.log'))
    original_stdout, original_stderr = sys.stdout, sys.stderr
    with log.open('a', encoding='utf-8', buffering=1) as output:
        sys.stdout = sys.stderr = output
        try:
            if sys.version_info < (3,10): raise RuntimeError('Install Python 3.10 or newer, then try again.')
            if not (root/'expense_book.py').is_file(): raise FileNotFoundError('expense_book.py is unavailable.')
            sys.path.insert(0,str(root))
            sys.argv=[str(root/'expense_book.py')]
            import expense_book
            expense_book.main()
        except Exception as exc:
            traceback.print_exc()
            message(explain(exc, root, log))
            return 1
        finally:
            sys.stdout, sys.stderr = original_stdout, original_stderr
    return 0

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--worker',action='store_true')
    parser.add_argument('--install-shortcut',action='store_true')
    args=parser.parse_args()
    root=Path(__file__).resolve().parent
    try:
        if args.install_shortcut:
            install_shortcut(root);return 0
        if args.worker or os.name!='nt': return worker(root)
        # Start a detached process; no long-lived console and no shell commands.
        subprocess.Popen([sys.executable,str(root/'quiet_start.py'),'--worker'],
                         cwd=str(root),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
        return 0
    except Exception as exc:
        message('Ctrl Ur Finances could not start. Check access to the shared folder and your Python installation.\n\n'+str(exc))
        return 1

if __name__=='__main__': raise SystemExit(main())
