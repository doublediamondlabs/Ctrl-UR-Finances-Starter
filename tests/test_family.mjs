import assert from 'node:assert/strict';
import { schedule, calculateLoan, statementHTML, validateLoan } from '../app/Source/loan.js';
import { saveForwarding, allocated } from '../app/Source/forwarding.js';
const loan = {
  principal: 1000,
  start: '2026-01',
  initialPayment: 100,
  monthlyPayment: 100,
  rateChange: '2026-01',
  dueDay: 15,
  graceDays: 4,
  receipts: [{
    id: 'a',
    month: '2026-01',
    date: '2026-01-19',
    amount: 100,
    note: 'PRIVATE RECEIPT'
  }, {
    id: 'b',
    month: '2026-02',
    date: '2026-02-20',
    amount: 100
  }],
  remittances: [],
  openingForwarded: null,
  openingForwardedDate: '',
  agreementReference: {
    title: 'Private example',
    text: 'PRIVATE REFERENCE'
  },
  forwardingRecipient: 'PRIVATE RECIPIENT'
};
assert.equal(schedule(loan).length, 10);
assert.equal(calculateLoan(loan, '2026-01-20').rows[0].status, 'On time');
assert.equal(calculateLoan(loan, '2026-02-19').arrears, 0);
assert.equal(calculateLoan(loan, '2026-02-21').rows[1].status, 'Paid late');
const before = calculateLoan(loan, '2026-03-20');
const next = validateLoan(saveForwarding(loan, {
  date: '2026-02-23',
  amount: 150,
  selected: {
    a: 100,
    b: 50
  },
  note: 'PRIVATE BATCH'
}));
assert.equal(allocated(next, 'b'), 50);
assert.equal(calculateLoan(next, '2026-03-20').balance, before.balance);
assert.equal(calculateLoan(next, '2026-03-20').held, 50);
assert.throws(() => saveForwarding(next, {
  date: '2026-02-24',
  amount: 100,
  selected: {
    a: 100
  }
}));
const html = statementHTML(next, '2026-03-20');
for (const marker of ['PRIVATE RECEIPT', 'PRIVATE BATCH', 'PRIVATE REFERENCE', 'PRIVATE RECIPIENT']) assert.ok(!html.includes(marker));
console.log('PASS generic family model: grace boundary, on-time/late, partial forwarding, no double allocation, unchanged principal and private snapshot exclusions.');
