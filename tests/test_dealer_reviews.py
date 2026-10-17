from pathlib import Path
import sys,types,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
from inspection_store import validate_dealer_reviews
app=types.SimpleNamespace(UserError=ValueError)
item={'signature':'record fingerprint','note':'Details unavailable after review','reviewedAt':'2026-10-15T00:00:00Z'}
validate_dealer_reviews(app,json.loads(json.dumps({'visit':item})))
validate_dealer_reviews(app,{})
for bad in [[],{'visit':None},{'visit':{**item,'note':''}},{'visit':{**item,'note':'x'*1001}},{'visit':{**item,'extra':'no'}},{'visit':{**item,'signature':4}}]:
 try:validate_dealer_reviews(app,bad);raise AssertionError('Invalid review accepted')
 except ValueError:pass
print('PASS dealer acknowledgement validation and JSON reload.')
