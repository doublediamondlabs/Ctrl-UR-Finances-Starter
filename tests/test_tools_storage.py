from pathlib import Path
import sys,tempfile,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import expense_book as app,preferences as p
with tempfile.TemporaryDirectory() as td:
 app.CONFIG=Path(td)/'linked-workbooks.json';app.persist_config({'years':{},'movePlanner':{'keep':'unchanged'}})
 a='11111111-1111-1111-1111-111111111111';b='22222222-2222-2222-2222-222222222222'
 x=p.tools_layout(app,a,{'layout':{'pins':['summary'],'order':['summary','compare']},'previous':{}})
 assert p.tools_layout(app,a)==x;assert p.tools_layout(app,b)=={'layout':{}}
 try:p.tools_layout(app,a,{'layout':{'pins':[],'order':[]},'previous':{}});raise AssertionError('stale layout accepted')
 except app.UserError as e:assert e.status==409
 assert app.load_config()['movePlanner']=={'keep':'unchanged'}
 print('PASS independent browser shortcut storage, stale-window rejection, unrelated planner preserved.')
