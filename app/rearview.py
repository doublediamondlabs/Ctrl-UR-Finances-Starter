import json,hashlib,base64,re
def target(app,year):
    if type(year) is not int or not 1900<=year<=2200: raise app.UserError('Choose a valid year.')
    return app.DATA/('rearview-'+str(year)+'.json')
def read(app,year):
    p=target(app,year);raw=p.read_bytes() if p.exists() else b''
    return {'data':json.loads(raw) if raw else None,'revision':hashlib.sha256(raw).hexdigest()}
def validate(app,data):
    def text(v,n):
        if not isinstance(v,str) or len(v)>n: raise app.UserError('A memory field is too long or invalid.')
    def photo(v):
        if not isinstance(v,dict) or set(v)!={'image','caption'}: raise app.UserError('Invalid photo.')
        text(v['caption'],300);text(v['image'],600000)
        try:
            if not v['image'].startswith('data:image/jpeg;base64,'): raise ValueError()
            b=base64.b64decode(v['image'].split(',',1)[1],validate=True)
            if not b.startswith(b'\xff\xd8\xff') or not b.endswith(b'\xff\xd9'): raise ValueError()
        except Exception: raise app.UserError('Upload the photo again using the photo button.')
    if not isinstance(data,dict) or set(data)!={'title','intro','outlook','cover','months'}: raise app.UserError('Invalid yearbook.')
    text(data['title'],100);text(data['intro'],2000);text(data['outlook'],2000)
    if data['cover'] is not None: photo(data['cover'])
    if not isinstance(data['months'],list) or len(data['months'])!=12: raise app.UserError('The yearbook needs twelve months.')
    for month in data['months']:
        if not isinstance(month,dict) or set(month)!={'note','photos'}: raise app.UserError('Invalid month memory.')
        text(month['note'],3000)
        if not isinstance(month['photos'],list) or len(month['photos'])>2: raise app.UserError('Use up to two photos per month.')
        for p in month['photos']: photo(p)
def save(app,body):
    year=body.get('year');p=target(app,year);data=body.get('data');validate(app,data)
    if body.get('revision')!=read(app,year)['revision']: raise app.UserError('This yearbook changed in another window. Your draft is still here. Reload saved memories before editing again.',409)
    app.atomic_file(p,json.dumps(data,ensure_ascii=False).encode(),backup=False)
    return read(app,year)
