from pathlib import Path
import sys,tempfile,json,base64,copy,struct,zlib,shutil
root=Path(__file__).resolve().parents[1];code=root/'app';sys.path.insert(0,str(code))
import expense_book as app,preferences as pref,recovery,portable_copy
import io,zipfile
fixture=io.BytesIO()
with zipfile.ZipFile(fixture,'w') as z:
 z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
raw=fixture.getvalue() # Minimal synthetic container for storage tests, not a user template.
def png():
 def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\x32\x66\x99\xff'))+chunk(b'IEND',b'')
with tempfile.TemporaryDirectory() as td:
 app.ROOT=Path(td)/'App';app.ROOT.mkdir();app.DATA=app.ROOT/'User-Data';app.CONFIG=app.DATA/'linked-workbooks.json';app.LOCATION=app.ROOT/'data-location.json'
 for p in code.iterdir():
  if p.is_file():shutil.copy2(p,app.ROOT/p.name)
 external=Path(td)/'External-Data'
 assert pref.defaults(True)['modules']['rom'] is False;legacy={'years':{'2026':{}},'preferences':pref.defaults(True)};legacy['preferences']['modules'].pop('rom');original_config=app.load_config;app.load_config=lambda:legacy;assert pref.get(app)['modules']['rom'] is False;assert 'rom' not in legacy['preferences']['modules'];app.load_config=original_config;assert not pref.packet(app)['initialized'];assert not any(pref.get(app)['modules'].values())
 pref.setup(app,{'householdName':'SYNTHETIC QA','year':2026,'dataDirectory':str(external),'base64':base64.b64encode(raw).decode()});assert app.DATA==external;assert pref.packet(app)['initialized'];assert app.workbook_path(2026)[0].exists()
 state=pref.packet(app);bad=copy.deepcopy(state['preferences']);bad['modules']['inspections']=True
 try:pref.save(app,{'revision':state['revision'],'preferences':bad});raise AssertionError('dependency ignored')
 except app.UserError:pass
 bad['modules']['business']=True;bad['title']='QA TITLE';saved=pref.save(app,{'revision':state['revision'],'preferences':bad,'logoBase64':base64.b64encode(png()).decode()});assert saved['preferences']['logo']=='appearance-logo.png';assert (external/'appearance-logo.png').read_bytes()==png()
 try:pref.save(app,{'revision':state['revision'],'preferences':bad});raise AssertionError('stale accepted')
 except app.UserError as e:assert e.status==409
 try:pref.save(app,{'revision':saved['revision'],'preferences':bad,'logoBase64':base64.b64encode(b'<svg><script/></svg>').decode()});raise AssertionError('non-PNG accepted')
 except app.UserError:pass
 assert (external/'appearance-logo.png').read_bytes()==png()
 # Settings changes only: workbook stays byte-identical.
 assert app.workbook_path(2026)[0].read_bytes()==raw
 for operation in [lambda:portable_copy.create_copy(external),lambda:recovery.create(app,{'destination':str(external/'NestedBackup')})]:
  try:operation();raise AssertionError('nested destination accepted')
  except ValueError:pass
 result=recovery.create(app,{});assert result['state']=='green',result
 preview=recovery.preview({'path':result['path']});restored=Path(recovery.restore(app,preview)['folder']);assert (restored/'User-Data/appearance-logo.png').read_bytes()==png();assert json.loads((restored/'data-location.json').read_text())['path']=='User-Data'
 cfg=json.loads((restored/'User-Data/linked-workbooks.json').read_text());assert (restored/cfg['years']['2026']['path']).read_bytes()==raw
 out=portable_copy.create_copy(Path(td));assert (out/'User-Data/appearance-logo.png').read_bytes()==png();assert json.loads((out/'data-location.json').read_text())['path']=='User-Data';cfg=json.loads((out/'User-Data/linked-workbooks.json').read_text());assert (out/cfg['years']['2026']['path']).read_bytes()==raw
 # Preserve current data on repeated setup attempt.
 try:pref.setup(app,{'householdName':'REPLACE','year':2027,'base64':base64.b64encode(raw).decode()});raise AssertionError('repeat setup accepted')
 except app.UserError as e:assert e.status==409
 assert app.load_config()['preferences']['title']=='QA TITLE'
 print('PASS settings/storage: external data setup, dependency validation, stale revision rejection, validated local PNG, financial bytes unchanged, verified full backup/restore and portable paths including logo.')
