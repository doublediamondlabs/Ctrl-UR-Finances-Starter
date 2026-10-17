"""Separate planning settings. Never writes to workbooks."""
import json,math,datetime as dt

def validate(data):
    if not isinstance(data,dict) or data.get('version')!=1 or not isinstance(data.get('enabled'),bool):raise ValueError('Invalid planner settings.')
    if len(json.dumps(data))>1500000:raise ValueError('Planner is too large; reduce saved scenarios.')
    def walk(v,depth=0):
        if depth>12:raise ValueError('Planner structure is too deep.')
        if isinstance(v,dict):
            if len(v)>12000 or any(not isinstance(k,str) or len(k)>500 for k in v):raise ValueError('Invalid planner fields.')
            for x in v.values():walk(x,depth+1)
        elif isinstance(v,list):
            if len(v)>12000:raise ValueError('Too many planner entries.')
            for x in v:walk(x,depth+1)
        elif isinstance(v,str):
            if len(v)>1000000:raise ValueError('Planner text is too long.')
        elif isinstance(v,(float,int)):
            if not math.isfinite(v) or abs(v)>1e12:raise ValueError('Invalid planner number.')
        elif v is not None:raise ValueError('Invalid planner value.')
    walk(data)
    plans=data.get('plans')
    if not isinstance(plans,list) or not 1<=len(plans)<=12:raise ValueError('Keep between 1 and 12 scenarios.')
    ids=[]
    for p in plans:
        if not isinstance(p,dict) or not isinstance(p.get('id'),str) or not p['id'] or len(p['id'])>100:raise ValueError('Invalid scenario.')
        ids.append(p['id'])
        if not isinstance(p.get('name'),str) or not p['name'].strip() or len(p['name'])>120:raise ValueError('Name each scenario (120 characters maximum).')
    if len(ids)!=len(set(ids)):raise ValueError('Duplicate scenarios.')
    if data.get('active') not in ids:raise ValueError('Choose an existing scenario.')

def read(app):return {'planner':app.load_config().get('movePlanner')}
def save(app,body):
    data=body.get('planner')
    try:validate(data)
    except (ValueError,TypeError) as exc:raise app.UserError(str(exc))
    cfg=app.load_config()
    if cfg.get('movePlanner')!=body.get('previous'):raise app.UserError('Planner changed in another window. Reload the page before saving. Your unsaved values are still shown.',409)
    cfg['movePlanner']=data;app.persist_config(cfg)
    return {'planner':data}
