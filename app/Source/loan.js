import { validateForwarding } from './forwarding.js';
export const cents = n => Math.round(Number(n || 0) * 100);
export const money = rows => rows.reduce((s, r) => s + cents(r.amount), 0) / 100;
export const monthKey = (year, index) => `${year}-${String(index + 1).padStart(2, '0')}`;
export function schedule(loan) {
  let remaining = cents(loan.principal),
    out = [],
    date = new Date(loan.start + '-01T12:00:00Z');
  for (let i = 0; remaining > 0 && i < 600; i++) {
    const month = date.toISOString().slice(0, 7),
      amount = Math.min(remaining, cents(month < loan.rateChange ? loan.initialPayment : loan.monthlyPayment));
    if (amount <= 0) throw Error('Monthly payment must be positive.');
    const due = month + '-' + String(loan.dueDay).padStart(2, '0'),
      end = new Date(due + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() + (loan.graceDays || 0));
    out.push({
      month,
      due,
      deadline: end.toISOString().slice(0, 10),
      amount: amount / 100
    });
    remaining -= amount;
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  if (remaining > 0) throw Error('Loan term exceeds 50 years.');
  return out;
}
export function calculateLoan(loan, asOf) {
  const payments = loan.receipts.filter(r => (r.date || r.month + '-01') <= asOf && r.month <= asOf.slice(0, 7)),
    paid = money(payments);
  const rows = schedule(loan).map(s => {
    const receipts = payments.filter(r => r.month === s.month),
      received = cents(money(receipts)),
      due = cents(s.amount),
      onTime = receipts.filter(r => r.date ? r.date <= s.deadline : r.timing === 'onTime'),
      unknown = receipts.filter(r => !r.date && r.timing !== 'onTime');
    let status = asOf < s.due ? 'Upcoming' : asOf === s.due ? 'Due today' : asOf <= s.deadline ? 'Within grace period' : 'No payment received';
    if (received >= due) status = cents(money(onTime)) >= due ? 'On time' : cents(money(onTime)) + cents(money(unknown)) >= due ? 'Received · date unverified' : 'Paid late';else if (received > 0) status = asOf > s.deadline ? 'Partial · below expected' : 'Partial';
    return {
      ...s,
      paid: received / 100,
      missing: Math.max(0, due - received) / 100,
      status,
      overdue: s.deadline < asOf ? Math.max(0, due - received) / 100 : 0
    };
  });
  const scheduledDue = money(rows.filter(r => r.deadline < asOf));
  const forwarded = loan.openingForwarded === null || asOf < loan.openingForwardedDate ? null : Number(loan.openingForwarded) + money(loan.remittances.filter(r => r.date <= asOf));
  return {
    paid,
    scheduledDue,
    balance: Math.max(0, cents(loan.principal - paid) / 100),
    rows,
    arrears: Math.max(0, cents(scheduledDue - paid) / 100),
    forwarded,
    held: forwarded === null ? null : cents(paid - forwarded) / 100
  };
}
export function validateLoan(loan) {
  if (loan.graceDays !== undefined && (!Number.isInteger(loan.graceDays) || loan.graceDays < 0 || loan.graceDays > 14)) throw Error('Grace period must be 0 to 14 days.');
  if (!Number.isFinite(loan.principal) || loan.principal <= 0 || !Number.isInteger(loan.dueDay) || loan.dueDay < 1 || loan.dueDay > 28) throw Error('Invalid loan terms.');
  schedule(loan);
  const ids = new Set();
  for (const r of loan.receipts) {
    if (ids.has(r.id)) throw Error('Duplicate receipt ID.');
    ids.add(r.id);
    if (!validDate(r.month + '-01') || !Number.isFinite(r.amount) || r.amount <= 0) throw Error('Each receipt needs a month and positive amount.');
    if (r.date && (!validDate(r.date) || r.date.slice(0, 7) !== r.month)) throw Error('Receipt date must be within its receipt month.');
    if ((r.note || '').length > 3000) throw Error('Keep notes under 3,000 characters.');
  }
  if (money(loan.receipts) > loan.principal) throw Error('Receipts exceed the original principal.');
  if (loan.openingForwarded !== null && (!Number.isFinite(loan.openingForwarded) || loan.openingForwarded < 0 || !validDate(loan.openingForwardedDate))) throw Error('Enter a valid opening remittance amount and as-of date.');
  for (const r of loan.remittances) {
    if (!validDate(r.date) || !Number.isFinite(r.amount) || r.amount <= 0) throw Error('Each remittance needs a valid date and positive amount.');
    if (loan.openingForwarded !== null && r.date < loan.openingForwardedDate) throw Error('Remittances must be on or after the opening remittance date.');
  }
  if (loan.openingForwarded !== null) {
    const byDate = loan.remittances.slice().sort((a, b) => a.date.localeCompare(b.date));
    let sent = loan.openingForwarded;
    const receivedAt = d => money(loan.receipts.filter(r => (r.date || r.month + '-01') <= d));
    if (sent > receivedAt(loan.openingForwardedDate)) throw Error('Opening forwarded total exceeds receipts available by that date.');
    for (const r of byDate) {
      sent += r.amount;
      if (cents(sent) > cents(receivedAt(r.date))) throw Error('A remittance exceeds receipts available by its date.');
    }
  }
  if (loan.openingForwarded !== null && loan.openingForwarded + money(loan.remittances) > money(loan.receipts)) throw Error('Forwarded amounts exceed receipts.');
  return validateForwarding(loan);
}
export function validDate(v) {
  const d = new Date(v + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export function statementData(loan, asOf) {
  const c = calculateLoan(loan, asOf);
  return {
    borrower: loan.borrower,
    asOf,
    principal: loan.principal,
    interest: 'No interest',
    dueDay: loan.dueDay,
    graceDays: loan.graceDays || 0,
    monthlyPayment: loan.monthlyPayment,
    paid: c.paid,
    scheduledDue: c.scheduledDue,
    balance: c.balance,
    arrears: c.arrears,
    rows: c.rows,
    receipts: loan.receipts.filter(r => r.month <= asOf.slice(0, 7) && (!r.date || r.date <= asOf)).map(r => ({
      date: r.date || r.month + ' (day not recorded)',
      amount: r.amount
    }))
  };
}
export function statementHTML(loan, asOf) {
  const d = statementData(loan, asOf),
    esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    cash = n => Number(n).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(d.borrower)} — repayment statement</title><style>body{font:15px system-ui;max-width:960px;margin:36px auto;padding:0 24px;color:#183044}h1{margin-bottom:4px}.metrics{display:flex;gap:24px;flex-wrap:wrap;padding:20px;background:#f1f5f8}.metrics strong{display:block;font-size:23px}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #dde4eb}th{background:#edf2f7}.bad{color:#b42318}.good{color:#16703a}small{color:#536272}@media print{body{margin:0;font-size:11px}thead{display:table-header-group}tr{break-inside:avoid}}</style><h1>${esc(d.borrower)} · Repayment statement</h1><p>As of ${esc(d.asOf)} · Original amount ${cash(d.principal)} · No interest · Due on the ${esc(d.dueDay)}th${d.graceDays ? ` · ${esc(d.graceDays)}-day grace period` : ""}</p><div class="metrics"><div>Total paid<strong>${cash(d.paid)}</strong></div><div>Remaining balance<strong>${cash(d.balance)}</strong></div></div><h2>Payment position · ${esc(d.asOf)}</h2><div class="metrics"><div>Expected after grace period<strong>${cash(d.scheduledDue)}</strong></div><div>Received through this date<strong>${cash(d.paid)}</strong></div><div>Amount to catch up<strong class="${d.arrears ? 'bad' : 'good'}">${cash(d.arrears)}</strong></div></div><p>Current monthly payment: ${cash(d.monthlyPayment)}. Catch-up is included in the remaining balance, not added to it. Payments still within their due date or grace period are not counted as overdue.</p><p>Monthly history records when payments arrived. Later payments reduce catch-up without changing missed months. Do not add historical monthly gaps to catch-up.</p><h2>Payments received in ${esc(asOf.slice(0, 7))}</h2><table><thead><tr><th>Received</th><th>Amount</th></tr></thead><tbody>${d.receipts.filter(r => r.date.startsWith(asOf.slice(0, 7))).map(r => `<tr><td>${esc(r.date)}</td><td>${cash(r.amount)}</td></tr>`).join('')}</tbody></table><h2>Monthly payment history · ${esc(asOf.slice(0, 4))}</h2><table><thead><tr><th>Due</th><th>Grace ends</th><th>Scheduled</th><th>Received that month</th><th>Historical gap</th><th>Status</th></tr></thead><tbody>${d.rows.filter(r => r.month.startsWith(asOf.slice(0, 4))).map(r => `<tr><td>${esc(r.due)}</td><td>${esc(r.deadline)}</td><td>${cash(r.amount)}</td><td>${cash(r.paid)}</td><td>${cash(r.missing)}</td><td class="${r.overdue ? 'bad' : r.status === 'On time' ? 'good' : ''}">${esc(r.status)}</td></tr>`).join('')}</tbody></table><small>Historical payment days were not recorded in the source sheet. Imported on-time markings are retained; exact dates can be corrected in the ledger. An unknown-day receipt is included in statements for its reported month.</small></html>`;
}
