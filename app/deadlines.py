"""User-maintained obligations; dates are never inferred from tax rules."""
import calendar, datetime as dt, uuid

def date(value,optional=False):
    if optional and value=='':return
    if not isinstance(value,str) or len(value)!=10 or dt.date.fromisoformat(value).isoformat()!=value:raise ValueError('Enter a valid date.')

def update(app,body):
    cfg=app.load_config();previous=cfg.get('deadlines',[])
    if previous!=body.get('previous'):raise app.UserError('Deadlines changed in another window. Reload the list before saving.',409)
    rows=body.get('items');ids=set()
    if not isinstance(rows,list) or len(rows)>2000:raise ValueError('Invalid deadline list.')
    for r in rows:
        if not isinstance(r,dict) or set(r)-{'id','title','area','due','warningDays','repeat','note','completed','created','updated','nextId','color','rank','recurrenceDay'}:raise ValueError('Invalid deadline.')
        for key,limit in [('id',80),('title',200),('note',5000),('created',50),('updated',50),('nextId',80)]:
            if not isinstance(r.get(key,''),str) or len(r.get(key,''))>limit:raise ValueError('Invalid deadline text.')
        if not r.get('title','').strip() or not r.get('id') or r['id'] in ids:raise ValueError('Each deadline needs a title and unique ID.')
        ids.add(r['id'])
        if r.get('area') not in ('Business','Personal','Family','Other') or r.get('repeat') not in ('none','annual','monthly'):raise ValueError('Invalid deadline options.')
        if type(r.get('warningDays')) is not int or not 0<=r['warningDays']<=365:raise ValueError('Warning period must be 0–365 days.')
        if r.get('color','slate') not in ('slate','blue','teal','green','amber','rose','purple'):raise ValueError('Choose a task color from the palette.')
        if 'rank' in r and (type(r['rank']) is not int or not 0<=r['rank']<=2000):raise ValueError('Invalid task order.')
        if 'recurrenceDay' in r and (type(r['recurrenceDay']) is not int or not 1<=r['recurrenceDay']<=31):raise ValueError('Invalid monthly recurrence day.')
        date(r.get('due'));date(r.get('completed',''),True)
        if r.get('completed','')>dt.date.today().isoformat():raise ValueError('Completion date cannot be in the future.')
    old={r['id']:r for r in previous};now=dt.datetime.now().astimezone().isoformat(timespec='seconds')
    generated=[]
    for r in rows:
        prior=old.get(r['id'])
        # Completed history is retained: remove or edit the next occurrence separately.
        if prior and prior.get('completed') and r!=prior:raise ValueError('Completed history is read-only. Add a corrected item if needed.')
        if not prior or r!=prior:
            r['created']=prior.get('created',now) if prior else now;r['updated']=now
            if r['repeat']=='monthly':
                r['recurrenceDay']=dt.date.fromisoformat(r['due']).day if not prior or prior.get('repeat')!='monthly' or prior['due']!=r['due'] else prior.get('recurrenceDay',dt.date.fromisoformat(r['due']).day)
            else:r.pop('recurrenceDay',None)
            if r.get('completed') and not (prior or {}).get('completed') and r['repeat'] in ('annual','monthly'):
                d=dt.date.fromisoformat(r['due'])
                if r['repeat']=='monthly':
                    year=d.year+(d.month==12);month=d.month%12+1;day=r['recurrenceDay']
                else:year=d.year+1;month=d.month;day=d.day
                following=dt.date(year,month,min(day,calendar.monthrange(year,month)[1])).isoformat()
                nextid=str(uuid.uuid4());r['nextId']=nextid
                generated.append({**r,'id':nextid,'due':following,'completed':'','nextId':'','created':now,'updated':now})
    for item in generated:item.pop('rank',None)
    cfg['deadlines']=rows+generated;app.persist_config(cfg)
    return {'items':cfg['deadlines']}
