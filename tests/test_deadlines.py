from pathlib import Path
import sys,copy
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import deadlines
class App:
 class UserError(Exception):pass
 def __init__(self):self.cfg={'years':{'2026':{'path':'unchanged.xlsx'}},'deadlines':[]}
 def load_config(self):return copy.deepcopy(self.cfg)
 def persist_config(self,c):self.cfg=copy.deepcopy(c)
a=App()
def save(rows,previous=None):return deadlines.update(a,{'previous':copy.deepcopy(a.cfg['deadlines']) if previous is None else previous,'items':copy.deepcopy(rows)})['items']
row=dict(id='a',title='Annual',area='Business',due='2024-02-29',warningDays=30,repeat='annual',note='Preserve me',completed='',color='purple',rank=0)
saved=save([row]);assert saved[0]['color']=='purple' and saved[0]['rank']==0
before=copy.deepcopy(saved);saved[0]['completed']='2024-03-01';saved=save(saved);assert len(saved)==2 and saved[1]['due']=='2025-02-28' and saved[1]['color']=='purple' and 'rank' not in saved[1]
try:save(saved,previous=before);raise AssertionError('stale accepted')
except App.UserError:pass
for change in [{'color':'invalid'},{'rank':-1},{'rank':True}]:
 rows=copy.deepcopy(saved);rows[1].update(change)
 try:save(rows);raise AssertionError('invalid accepted')
 except ValueError:pass
rows=copy.deepcopy(saved);rows[0]['note']='changed'
try:save(rows);raise AssertionError('history altered')
except ValueError:pass
assert a.cfg['years']['2026']['path']=='unchanged.xlsx'
print('PASS deadlines: color/order persisted, annual recurrence and leap date preserved, stale edits rejected, history read-only, invalid metadata rejected.')
a=App()
monthly={**row,'repeat':'monthly','due':'2024-01-31','completed':''}
rows=save([monthly]);assert rows[0]['recurrenceDay']==31
rows[0]['completed']='2024-02-05';rows=save(rows);assert rows[-1]['due']=='2024-02-29'
rows[-1]['completed']='2024-03-10';rows=save(rows);assert rows[-1]['due']=='2024-03-31'
count=len(rows);rows=save(rows);assert len(rows)==count
rows[-1]['due']='2024-03-15';rows=save(rows);assert rows[-1]['recurrenceDay']==15
rows[-1]['completed']='2024-03-15';rows=save(rows);assert rows[-1]['due']=='2024-04-15'
a=App();rows=save([{**monthly,'due':'2024-12-31','completed':'2024-12-31'}]);assert rows[-1]['due']=='2025-01-31'
print('PASS monthly: scheduled-date recurrence, leap/end-of-month anchor recovery, December rollover, edited day reset, no duplicate generation on re-save.')
