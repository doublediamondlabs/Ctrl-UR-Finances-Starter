from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import inspection_store
class App:
 class UserError(Exception):pass
base={'id':'a','name':'North','address':'Road','notes':'unchanged','miles':120}
inspection_store.validate_destinations(App,[base])
inspection_store.validate_destinations(App,[dict(base,reminder='Call first')])
inspection_store.validate_destinations(App,[dict(base,reminder='')])
for bad in [None,5,'x'*1001]:
 try:inspection_store.validate_destinations(App,[dict(base,reminder=bad)]);raise AssertionError('invalid reminder accepted')
 except App.UserError:pass
print('PASS backend reminder validation and backward compatibility.')
