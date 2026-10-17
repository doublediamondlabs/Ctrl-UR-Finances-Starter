from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import inspection_store
class App:
 class UserError(Exception):pass
base={'id':'a','name':'Test','address':'','notes':'','miles':1}
for value in ['', '01234','01234-5678']:inspection_store.validate_destinations(App,[dict(base,zip=value)])
inspection_store.validate_destinations(App,[base])
for value in [1234,None,'0'*11]:
 try:inspection_store.validate_destinations(App,[dict(base,zip=value)]);raise AssertionError('Bad ZIP accepted')
 except App.UserError:pass
print('PASS optional ZIP validation, text-only and backward compatibility.')
