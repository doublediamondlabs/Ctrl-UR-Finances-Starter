from pathlib import Path
import sys, importlib.util
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'app'))
spec=importlib.util.spec_from_file_location('guard_app',root/'app/expense_book.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
cfg={'years':{'2026':{'path':'old.xlsx'}},'loan':{'path':'family.xlsx'}}
for action in ['link','unlink','create','loan/link','loan/create']:
 body={'year':2026};path='/api/'+action
 try:app.validate_link_change(cfg,path,body);raise AssertionError('unguarded accepted')
 except app.UserError:pass
 body['linkGuard']={'action':action,'previous':'stale.xlsx'}
 try:app.validate_link_change(cfg,path,body);raise AssertionError('stale accepted')
 except app.UserError:pass
 body['linkGuard']['previous']='family.xlsx' if action.startswith('loan/') else 'old.xlsx';app.validate_link_change(cfg,path,body)
print('PASS link guard: missing review rejected, stale path rejected, annual and family connection routes covered.')
