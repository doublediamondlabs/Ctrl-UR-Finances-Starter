"""Exercise real HTTP shutdown guards, process lock release and local launch reuse."""
import json,re,shutil,subprocess,sys,tempfile,threading,time,urllib.request,urllib.error
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import expense_book as app,backup_retention,recovery,quiet_start

def request(address,path,token='',body=None,origin=None):
 headers={'X-App-Token':token}
 if origin: headers['Origin']=origin
 data=json.dumps(body).encode() if body is not None else None
 req=urllib.request.Request(address+path,data=data,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=3) as response:return response.status,json.load(response)
 except urllib.error.HTTPError as exc:return exc.code,json.load(exc)

with tempfile.TemporaryDirectory() as td:
 root=Path(td);old=app.ROOT;old_data=app.DATA;app.ROOT=root;app.DATA=root
 server=app.HTTPServer(('127.0.0.1',0),app.Handler);address=f'http://127.0.0.1:{server.server_port}/'
 thread=threading.Thread(target=server.serve_forever);thread.start()
 try:
  assert request(address,'api/app/exit','wrong',{})[0]==403
  assert request(address,'api/app/exit',app.TOKEN,{},'https://example.com')[0]==403
  with patch.object(recovery,'running',return_value=True):assert request(address,'api/app/exit',app.TOKEN,{})[0]==409
  with patch.object(backup_retention,'scanning',return_value=True):assert request(address,'api/app/exit',app.TOKEN,{})[0]==409
  assert thread.is_alive()
  # An interrupted journal must not trap a running app without an Exit action.
  (root/'inspection-transaction.json').write_text('{}')
  assert request(address,'api/app/exit',app.TOKEN,{})==(200,{'stopping':True})
  thread.join(3);assert not thread.is_alive()
 finally:
  server.shutdown();server.server_close();app.ROOT=old;app.DATA=old_data
 # Run the actual launcher entry point in a clean synthetic app, then reopen and exit.
 folder=root/'Synthetic-App';folder.mkdir()
 for p in old.glob('*.py'):shutil.copy2(p,folder/p.name)
 (folder/'web').mkdir();shutil.copy2(old/'web/index.html',folder/'web/index.html')
 def start():return subprocess.Popen([sys.executable,str(folder/'expense_book.py'),'--no-browser'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 for run in range(2):
  process=start()
  try:
   for i in range(100):
    if (folder/'running-session.json').exists():break
    if process.poll() is not None:raise AssertionError(process.communicate())
    time.sleep(.03)
   session=json.loads((folder/'running-session.json').read_text());address=session['address']
   assert request(address,'app-instance')[1]['instance']==session['instance']
   # Same-machine launch verifies identity and exits without a second server.
   duplicate=subprocess.run([sys.executable,str(folder/'expense_book.py'),'--no-browser'],capture_output=True,timeout=5)
   assert duplicate.returncode==0,duplicate.stderr
   with urllib.request.urlopen(address) as response:html=response.read().decode()
   token=re.search(r'name="app-token" content="([^"]+)"',html)[1]
   assert request(address,'api/app/exit',token,{})[0]==200
   assert process.wait(timeout=5)==0
   assert not (folder/'running-session.json').exists()
   assert not (folder/'running-address.txt').exists()
  finally:
   if process.poll() is None:process.kill();process.wait()
 # Wrong-machine or stale session information must never open an unrelated localhost.
 app.ROOT=folder
 try:
  (folder/'running-session.json').write_text(json.dumps({'computer':'other-test-computer','address':'http://127.0.0.1:1/','instance':'test'}))
  with patch.object(app.webbrowser,'open') as browser:
   try:app.existing_session();raise AssertionError('Wrong host accepted')
   except app.UserError as exc:assert 'another computer' in str(exc)
   browser.assert_not_called()
 finally:app.ROOT=old
 assert 'network connection' in quiet_start.explain(FileNotFoundError('missing'),folder,'test.log')
 assert 'denied access' in quiet_start.explain(PermissionError('denied'),folder,'test.log')
print('PASS authenticated exit; blocked during backup/scan; actual process shutdown, lock release, relaunch, duplicate reuse and wrong-computer detection.')
