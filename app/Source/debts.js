export const round = n => Math.round(n * 100) / 100;
export function breakdownMessage(link, amount) {
  const parts = ['principal', 'interest', 'escrow', 'fees'],
    missing = parts.filter(k => link[k] == null);
  if (missing.length) return 'Enter ' + missing.join(' and ') + '; use 0 if none. Blank means unknown.';
  if (parts.some(k => !Number.isFinite(link[k]) || link[k] < 0)) return 'Each breakdown amount must be zero or greater.';
  if (!Number.isFinite(amount)) return 'Enter the expense amount before verifying the breakdown.';
  if (link.paymentType === 'extra' && ['interest', 'escrow', 'fees'].some(k => link[k] !== 0)) return 'Extra-principal-only payments require 0 interest, escrow and fees. Use Regular payment if the lender applied other charges.';
  const total = round(parts.reduce((n, k) => n + link[k], 0)),
    difference = round(amount - total);
  return difference === 0 ? '' : 'Breakdown total $' + total.toFixed(2) + ' is $' + Math.abs(difference).toFixed(2) + (difference > 0 ? ' below' : ' above') + ' the expense amount $' + amount.toFixed(2) + '.';
}
export function linkedPayment(loan, link, books) {
  const book = books.find(b => b.year === link.year),
    r = book?.records.find(r => r.id === link.recordId);
  let issue = !book ? 'Workbook unavailable' : !r ? 'Expense missing' : r.kind !== 'expense' || r.scope !== (loan.area === 'business' ? 'business' : 'residence') ? 'Expense type/area changed' : r.state !== 'recorded' ? 'Planned expense' : !Number.isFinite(r.amount) || r.amount <= 0 ? 'Amount needs review' : null;
  if (!issue && (r.transactionDate && r.transactionDate !== link.date || r.month !== new Date(link.date + 'T12:00:00').toLocaleString('en-US', {
    month: 'long'
  }))) issue = 'Expense date/month changed';
  const parts = ['principal', 'interest', 'escrow', 'fees'];
  const complete = !breakdownMessage(link, r?.amount);
  return {
    ...link,
    record: r,
    issue,
    complete,
    breakdownIssue: breakdownMessage(link, r?.amount),
    amount: r?.amount ?? null
  };
}
export function debtSummary(loan, books, today) {
  const payments = loan.links.map(l => linkedPayment(loan, l, books)),
    after = payments.filter(p => p.date > loan.asOf && p.date <= today),
    uncertain = after.some(p => p.issue || !p.complete),
    balance = round(loan.balance - after.filter(p => !p.issue && p.complete).reduce((n, p) => n + p.principal, 0));
  return {
    payments,
    balance,
    uncertain: uncertain || balance < 0,
    state: loan.paidOff ? 'green' : uncertain || payments.some(p => p.issue || !p.complete) ? 'amber' : 'neutral',
    label: loan.paidOff ? 'Paid off' : uncertain ? 'Balance needs review' : 'Active · statement-based tracking'
  };
}
// Calendar dates describe the anchor-based illustration, not actual receipts or the manual next-due field.
export function estimatedDate(loan, index) {
  const [year, month, day] = loan.asOf.split('-').map(Number),
    due = Number(loan.dueDay);
  const offset = (day >= due ? 1 : 0) + index;
  const d = new Date(Date.UTC(year, month - 1 + offset, due));
  return d.toISOString().slice(0, 10);
}
export function estimate(loan) {
  let balance = loan.balance,
    rows = [];
  const rate = loan.rate / 1200;
  for (let i = 0; i < loan.term && balance > 0; i++) {
    const interest = round(balance * rate),
      regularPayment = round(Math.min(loan.payment, balance + interest)),
      extraPrincipal = round(Math.min(loan.plannedExtraPrincipal || 0, Math.max(0, balance + interest - regularPayment))),
      payment = round(regularPayment + extraPrincipal),
      principal = round(payment - interest);
    if (regularPayment < interest) return {
      rows,
      error: 'Regular payment does not cover estimated monthly interest. Extra principal is not used to cover interest.'
    };
    if (principal <= 0) return {
      rows,
      error: 'Payment does not cover estimated monthly interest.'
    };
    balance = round(Math.max(0, balance - principal));
    rows.push({
      month: i + 1,
      date: estimatedDate(loan, i),
      regularPayment,
      extraPrincipal,
      payment,
      interest,
      principal,
      balance
    });
  }
  return {
    rows,
    remaining: balance
  };
}
// v3 fields are additive. Never infer an original term from remaining months.
export function editableLoan(loan) {
  return {
    ...loan,
    plannedExtraPrincipal: loan.plannedExtraPrincipal ?? 0,
    originationDate: loan.originationDate ?? (loan.mode === 'original' ? loan.asOf : ''),
    originalTerm: loan.originalTerm ?? null,
    maturityDate: loan.maturityDate ?? '',
    payoffQuote: loan.payoffQuote ?? null,
    payoffQuoteDate: loan.payoffQuoteDate ?? ''
  };
}
