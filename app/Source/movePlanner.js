export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const number = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null;
export const KNOWN_ONE_OFFS = {};
export function defaultPlan() {
  return {
    id: crypto.randomUUID(),
    name: 'Moving scenario',
    income: '',
    incomeConfirmed: false,
    cushion: '',
    checking: '',
    savings: '',
    businessCash: '',
    cashDate: '',
    householdReserve: '',
    businessReserve: '',
    start: '',
    overlap: '6',
    horizon: '36',
    upfront: '',
    saleProceeds: '',
    mortgage: '',
    insurance: '',
    tax: '',
    hoa: '',
    maintenance: '',
    irregular: '',
    illinoisTax: '',
    illinoisTaxNote: 'Confirm any exemption change after moving.',
    businessIncome: '0',
    restart: '',
    notes: '',
    quotes: {},
    obligations: []
  };
}
export function baseline(book, selected, excluded = {}) {
  const months = [...new Set(selected)].filter(m => MONTHS.includes(m));
  if (!months.length) throw Error('Select at least one reviewed month.');
  const defs = new Map((book.householdCategories || []).map(c => [c.id, c.name]));
  const groups = new Map();
  for (const r of book.records || []) {
    if (r.scope !== 'residence' || r.kind !== 'expense' || r.state !== 'recorded' || !months.includes(r.month)) continue;
    const id = r.householdCategoryId || r.subCategory || r.category || 'Unassigned';
    if (!groups.has(id)) groups.set(id, {
      id,
      name: defs.get(id) || r.subCategory || r.category || 'Unassigned',
      entries: [],
      total: 0,
      futureTotal: 0,
      missing: 0
    });
    const g = groups.get(id);
    const amount = number(r.amount);
    g.entries.push({
      id: r.id,
      month: r.month,
      description: r.description,
      amount
    });
    g.total += amount || 0;
    if (!excluded[r.id]) {
      g.futureTotal += amount || 0;
      if (amount === null) g.missing++;
    }
  }
  const rows = [...groups.values()].map(g => ({
    ...g,
    total: money(g.total),
    futureTotal: money(g.futureTotal),
    average: money(g.futureTotal / months.length)
  }));
  return {
    year: book.year,
    months,
    refreshed: new Date().toISOString(),
    rows,
    total: money(rows.reduce((s, r) => s + r.total, 0)),
    fingerprint: JSON.stringify(rows.map(r => [r.id, r.entries]))
  };
}
export function suggestedRule(row) {
  return {
    mode: /^(Mortgage|Home Insurance)$/i.test(row.name) ? 'illinois' : 'continue',
    monthly: '',
    texas: '',
    overlap: '',
    reviewed: false,
    note: ''
  };
}
export function categoryCosts(snapshot, rules = {}) {
  let current = 0,
    ongoing = 0,
    illinois = 0;
  const issues = [];
  if (!snapshot?.rows?.length) return {
    current: 0,
    ongoing: 0,
    illinois: 0,
    issues: ['Refresh a Residence baseline.']
  };
  for (const row of snapshot.rows) {
    const r = rules[row.id] || suggestedRule(row);
    const amount = number(r.monthly) ?? row.average;
    current += row.average;
    if (amount < 0 || [r.texas, r.overlap].some(x => number(x) !== null && number(x) < 0)) issues.push(row.name + ': negative planning amount needs review');
    if (!r.reviewed) issues.push('Review ' + row.name);
    if (row.missing) issues.push(row.name + ': ' + row.missing + ' recorded amounts missing');
    if (r.mode === 'exclude') continue;
    if (r.mode === 'illinois') {
      illinois += number(r.overlap) ?? amount;
      continue;
    }
    if (r.mode === 'replace') {
      if (number(r.texas) === null) issues.push('New home estimate for ' + row.name);else ongoing += number(r.texas);
      illinois += number(r.overlap) ?? amount;
      continue;
    }
    ongoing += amount;
  }
  return {
    current: money(current),
    ongoing: money(ongoing),
    illinois: money(illinois),
    issues
  };
}
const monthIndex = s => /^\d{4}-\d{2}$/.test(s || '') && Number(s.slice(5)) >= 1 && Number(s.slice(5)) <= 12 ? Number(s.slice(0, 4)) * 12 + Number(s.slice(5)) - 1 : null;
const monthLabel = n => `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`;
export function calculate(plan, snapshot, rules, mode = 'both') {
  const c = categoryCosts(snapshot, rules),
    issues = [...c.issues];
  const need = (key, label) => {
    const n = number(plan[key]);
    if (n === null || n < 0) {
      issues.push(label);
      return 0;
    }
    return n;
  };
  const income = need('income', 'Reliable monthly income');
  if (!plan.incomeConfirmed) issues.push('Confirm reliable income');
  const mortgage = need('mortgage', 'New home principal & interest'),
    insurance = need('insurance', 'New home insurance'),
    tax = need('tax', 'New home property tax'),
    hoa = need('hoa', 'New home HOA'),
    maintenance = need('maintenance', 'Maintenance allowance'),
    irregular = need('irregular', 'Irregular expense allowance');
  const ilTax = mode === 'both' ? need('illinoisTax', 'Current home property tax during overlap') : 0;
  const start = monthIndex(plan.start);
  if (start === null) issues.push('Move month');
  const overlap = mode === 'sold' ? 0 : number(plan.overlap);
  if (!Number.isInteger(overlap) || overlap < 0 || overlap > 120) issues.push('Overlap months (0–120)');
  const horizon = number(plan.horizon);
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 120) issues.push('Projection months (1–120)');
  const checking = need('checking', 'Personal checking balance'),
    savings = need('savings', 'Personal savings balance'),
    business = need('businessCash', 'Business cash balance'),
    upfront = need('upfront', 'Moving & purchase cash costs');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.cashDate || '')) issues.push('Cash balances as-of date');
  const proceeds = need('saleProceeds', 'Net Current home sale proceeds (0 for a conservative scenario)');
  const reserved = number(plan.householdReserve) ?? 0,
    bReserved = number(plan.businessReserve) ?? 0;
  if (reserved < 0 || bReserved < 0) issues.push('Reserve amounts must be zero or greater');
  if (number(plan.cushion) !== null && number(plan.cushion) < 0) issues.push('Cushion must be zero or greater');
  const bIncome = need('businessIncome', 'Business monthly cash contribution');
  const restart = monthIndex(plan.restart);
  if (bIncome > 0 && restart === null) issues.push('Business restart month');
  const obligations = plan.obligations || [];
  for (const o of obligations) {
    if (number(o.monthly) === null || number(o.monthly) < 0) issues.push(o.name + ': monthly payment');
    if (o.payoff && monthIndex(o.payoff) === null) issues.push(o.name + ': payoff month');
    if (o.payoff && (number(o.payoffCash) === null || number(o.payoffCash) < 0)) issues.push(o.name + ': additional payoff cash (0 if none)');
  }
  const cashMonth = monthIndex((plan.cashDate || '').slice(0, 7));
  if (start !== null && cashMonth !== null && start < cashMonth) issues.push('Move month precedes the cash balances date');
  let beforePayoff = 0;
  for (const o of obligations) {
    const end = monthIndex(o.payoff);
    if (end !== null && start !== null && end < start && cashMonth !== null && end >= cashMonth) beforePayoff += number(o.payoffCash) || 0;
  }
  const base = c.ongoing + insurance + tax + hoa + maintenance + irregular;
  let household = money(checking + savings - upfront - beforePayoff + (mode === 'sold' || overlap === 0 ? proceeds : 0)),
    bCash = money(business);
  const rows = [];
  let firstNegative = null,
    firstReserve = null;
  if (household < 0 || bCash < 0) firstNegative = 'Before the move';
  if (household < reserved || bCash < bReserved) firstReserve = 'Before the move';
  for (let i = 0; i < Math.min(120, Math.max(0, horizon || 0)); i++) {
    const date = (start ?? 0) + i;
    const saleCash = mode === 'both' && overlap > 0 && i === overlap ? proceeds : 0;
    household = money(household + saleCash);
    let payments = 0,
      payoff = 0;
    for (const o of obligations) {
      const end = monthIndex(o.payoff);
      if (end === null || date <= end) payments += number(o.monthly) || 0;
      if (end !== null && date === end) payoff += number(o.payoffCash) || 0;
    }
    const contribution = bIncome > 0 && restart !== null && date >= restart ? bIncome : 0;
    bCash = money(bCash + contribution);
    const draw = money(Math.min(Math.max(0, bCash - bReserved), payments));
    bCash = money(bCash - draw);
    const il = i < overlap ? c.illinois + ilTax : 0;
    const out = money(base + mortgage + il + payments);
    const cashflow = money(income - out + draw - payoff);
    household = money(household + cashflow);
    const remaining = money(household + bCash);
    if (!firstNegative && household < 0) firstNegative = monthLabel(date);
    if (!firstReserve && household < reserved) firstReserve = monthLabel(date);
    rows.push({
      month: monthLabel(date),
      saleCash,
      income,
      expenses: out,
      illinois: money(il),
      payments: money(payments),
      businessDraw: draw,
      payoff: money(payoff),
      cashflow,
      household,
      business: bCash,
      total: remaining
    });
  }
  const endDate = (start ?? 0) + Math.max(overlap, 0);
  let ongoingPayments = 0;
  for (const o of obligations) {
    const end = monthIndex(o.payoff);
    if (end === null || endDate <= end) ongoingPayments += number(o.monthly) || 0;
  }
  const sustainable = money(income - base - mortgage - ongoingPayments);
  const cushion = number(plan.cushion);
  const room = money(income - base - ongoingPayments - (cushion ?? 0));
  return {
    issues: [...new Set(issues)],
    costs: c,
    rows,
    firstNegative,
    firstReserve,
    sustainable,
    room,
    cushion,
    initialHousehold: money(checking + savings - upfront - beforePayoff + (mode === 'sold' || overlap === 0 ? proceeds : 0)),
    beforePayoff,
    initialBusiness: business,
    postSaleMonth: monthLabel(endDate),
    businessAssumed: bIncome > 0
  };
}
