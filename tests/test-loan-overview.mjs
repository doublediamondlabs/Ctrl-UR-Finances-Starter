import assert from 'node:assert/strict';
import { calculateLoan } from '../app/Source/loan.js';
import { loanOverview } from '../app/Source/loanOverview.js';
const loan = {
  principal: 1260,
  start: '2026-09',
  rateChange: '2026-09',
  initialPayment: 315,
  monthlyPayment: 315,
  dueDay: 15,
  graceDays: 4,
  openingForwarded: null,
  receipts: [],
  remittances: []
};
const get = (receipts, date = '2026-10-16') => {
  const c = calculateLoan({
      ...loan,
      receipts
    }, date),
    before = JSON.stringify(c),
    v = loanOverview(c, date);
  assert.equal(JSON.stringify(c), before);
  return v;
};
const paid = {
  id: 'oct',
  month: '2026-10',
  date: '2026-10-15',
  amount: 315
};
assert.equal(get([paid]).next.due, '2026-11-15');
assert.match(get([paid]).label, /October installment · paid on time/);
assert.equal(get([]).next.due, '2026-10-15');
assert.equal(get([{
  ...paid,
  amount: 100
}]).next.due, '2026-10-15');
assert.match(get([{
  ...paid,
  date: '2026-10-21'
}], '2026-10-22').label, /paid late/);
assert.match(get([{
  ...paid,
  date: '',
  timing: 'unknown'
}]).label, /date unverified/);
assert.equal(get([], '2026-08-20').next.due, '2026-09-15');
assert.equal(get([], '2026-12-01').next.due, '2026-12-15');
assert.equal(get([], '2027-01-01').next, null);
assert.match(get([], '2027-01-01').label, /Outstanding shortfall/);
assert.equal(get([{
  ...paid,
  amount: 1260
}]).next, null);
assert.equal(get([{
  ...paid,
  amount: 1260
}]).label, 'Loan paid in full');
const rollover = calculateLoan({
  ...loan,
  principal: 1575,
  receipts: [{
    ...paid,
    month: '2026-12',
    date: '2026-12-15'
  }]
}, '2026-12-20');
assert.equal(loanOverview(rollover, '2026-12-20').next.due, '2027-01-15');
console.log('PASS next due, current unpaid/partial, late and unknown-date payment, pre-start, year rollover, payoff and historical-shortfall separation.');
