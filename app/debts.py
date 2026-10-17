"""Reusable loan metadata. Expense workbooks remain the payment source of truth."""
import datetime as dt,json,math,re,shutil

def read(app):
 p=app.DATA/'loan-trackers.json';data=p.read_bytes() if p.exists() else b'{"loans":[]}'
 return {'loans':json.loads(data)['loans'],'revision':app.digest(data)}
def save(app,body):
 current=read(app)
 if body.get('revision')!=current['revision']:raise app.UserError('Loan trackers changed. Reload trackers before saving.',409)
 loans=body.get('loans');ids=set();connections=set()
 if not isinstance(loans,list) or len(loans)>200:raise ValueError('Invalid loan list.')
 def date(s):
  if not isinstance(s,str) or len(s)!=10 or dt.date.fromisoformat(s).isoformat()!=s:raise ValueError('Enter a valid date.')
 def money(n):
  if type(n) not in (int,float) or not math.isfinite(n) or n<0 or n>1e10:raise ValueError('Amounts must be finite and nonnegative.')
 for loan in loans:
  if not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',loan.get('id','')) or loan['id'] in ids:raise ValueError('Invalid loan ID.')
  ids.add(loan['id'])
  for k,limit in [('name',150),('lender',150),('note',5000)]:
   if not isinstance(loan.get(k,''),str) or len(loan.get(k,''))>limit:raise ValueError('Invalid loan text.')
  if not loan.get('name','').strip():raise ValueError('Enter a loan name.')
  if loan.get('area') not in ('business','personal') or loan.get('mode') not in ('original','current'):raise ValueError('Choose a valid loan area/start.')
  for k in ('original','balance','payment','rate'):money(loan.get(k))
  if loan.get('plannedExtraPrincipal') is not None:money(loan['plannedExtraPrincipal'])
  if loan['original']<=0 or loan['rate']>100:raise ValueError('Check original principal and interest rate.')
  if type(loan.get('term')) is not int or not 1<=loan['term']<=600 or type(loan.get('dueDay')) is not int or not 1<=loan['dueDay']<=28:raise ValueError('Term must be 1–600 months; due day 1–28.')
  date(loan['asOf']);date(loan['nextDue'])
  if loan['asOf']>dt.date.today().isoformat():raise ValueError('Statement/opening balance date cannot be in the future.')
  for key in ('originationDate','maturityDate','payoffQuoteDate'):
   if loan.get(key):date(loan[key])
  if loan.get('originationDate'):
   if loan['originationDate']>loan['asOf']:raise ValueError('Origination date cannot follow the principal balance date.')
   if loan.get('maturityDate') and loan['maturityDate']<loan['originationDate']:raise ValueError('Maturity cannot precede origination.')
  if loan.get('originalTerm') is not None and (type(loan['originalTerm']) is not int or not 1<=loan['originalTerm']<=600):raise ValueError('Original term must be 1–600 months, or blank.')
  if (loan.get('payoffQuote') is not None)!=bool(loan.get('payoffQuoteDate')):raise ValueError('Enter both the payoff quote and its as-of date, or leave both blank.')
  if loan.get('payoffQuote') is not None:money(loan['payoffQuote'])
  if loan.get('paidOff'):
   date(loan['paidOff'])
   if loan['balance']!=0 or loan['paidOff']>dt.date.today().isoformat():raise ValueError('Confirm a zero principal balance and the non-future date actually paid in full first.')
  if type(loan.get('archived')) is not bool:raise ValueError('Invalid archive flag.')
  if not isinstance(loan.get('links'),list) or len(loan['links'])>10000:raise ValueError('Invalid expense links.')
  for link in loan['links']:
   if type(link.get('year')) is not int or not 1900<=link['year']<=2200 or not isinstance(link.get('recordId'),str) or not 1<=len(link['recordId'])<=200:raise ValueError('Invalid expense reference.')
   if link.get('paymentType','regular') not in ('regular','extra'):raise ValueError('Choose a valid payment purpose.')
   if link.get('paymentType')=='extra' and any(link.get(k) not in (None,0) for k in ('interest','escrow','fees')):raise ValueError('Extra-principal-only payments require zero interest, escrow and fees. Choose Regular payment for other charges.')
   key=(link['year'],link['recordId'])
   if key in connections:raise ValueError('An expense can connect to only one loan, once.')
   connections.add(key);date(link['date'])
   if int(link['date'][:4])!=link['year']:raise ValueError('Payment date must match expense year.')
   for k in ('principal','interest','escrow','fees'):
    if link.get(k) is not None:money(link.get(k))
 p=app.DATA/'loan-trackers.json'
 if p.exists():
  history=app.DATA/'Loan-Tracker-Backups';history.mkdir(exist_ok=True);shutil.copy2(p,history/(dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json'))
 app.atomic_file(p,json.dumps({'loans':loans},indent=2).encode(),backup=False)
 return read(app)
