import assert from 'node:assert/strict';
import { spendingPeriod, compareSpending, spendingMix, categoryColor, selectedSpendingMix, selectedSpendingPeriod } from '../app/Source/spendingSnapshot.js';
import { markReconciliation } from '../app/Source/analytics.js';
const row = (id, month, amount, category = 'Food', extra = {}) => ({
  id,
  month,
  amount,
  kind: 'expense',
  scope: 'residence',
  state: 'recorded',
  category: 'Residence',
  subCategory: category,
  description: category,
  sheet: month,
  ...extra
});
const book = {
  year: 2026,
  notes: [],
  records: [row('a', 'September', 100), row('b', 'September', -20), row('c', 'October', 120), row('d', 'October', null, 'Fuel'), row('plan', 'October', 900, 'Food', {
    state: 'planned'
  }), row('biz', 'October', 700, 'Office', {
    scope: 'business',
    category: 'Office'
  }), row('income', 'October', 2000, 'Salary', {
    kind: 'income'
  })],
  transfers: [{
    id: 't',
    date: '2026-10-10',
    amount: 999,
    scope: 'personal',
    from: 'A',
    to: 'B'
  }]
};
const now = new Date(2026, 9, 16),
  a = spendingPeriod(book, {}, 'personal', 8, 8, now),
  b = spendingPeriod(book, {}, 'personal', 9, 9, now);
assert.equal(a.total, 80);
assert.equal(a.charges, 100);
assert.equal(a.refunds, -20);
assert.equal(b.total, 120);
assert.equal(b.missing, 1);
assert.equal(b.rows.length, 2);
assert.ok(b.current);
assert.ok(!a.current);
assert.ok(!b.future);
const groups = compareSpending(a, b);
assert.equal(groups.find(g => g.label === 'Food').amount, 40);
assert.equal(groups.find(g => g.label === 'Food').percent, 50);
assert.equal(groups.find(g => g.label === 'Fuel').missing, 1);
assert.equal(spendingPeriod(book, {}, 'business', 9, 9, now).total, 700);
assert.ok(spendingPeriod(book, {}, 'personal', 0, 11, now).future);
const settings = markReconciliation(book, {}, 'personal', 8);
assert.equal(spendingPeriod(book, settings, 'personal', 8, 8, now).reviewed, 1);
assert.equal(spendingPeriod({
  ...book,
  records: book.records.map(r => r.id === 'a' ? {
    ...r,
    amount: 101
  } : r)
}, settings, 'personal', 8, 8, now).statuses[0].state, 'Changed since review');
const other = {
  ...book,
  year: 2025,
  records: [row('x', 'January', 20), row('y', 'October', 30)],
  transfers: []
};
assert.equal(spendingPeriod(other, {}, 'personal', 0, 8, now).total, 20);
assert.equal(spendingPeriod(null, {}, 'personal', 0, 11), null);
assert.deepEqual(compareSpending(null, b), []);
const many = {
  year: 2026,
  notes: [],
  records: Array.from({
    length: 10
  }, (_, i) => row('r' + i, 'October', i + 1, 'Category ' + i))
};
const p = spendingPeriod(many, {}, 'personal', 9, 9, now),
  mix = spendingMix(a, p);
assert.equal(mix.length, 7);
assert.equal(mix.at(-1).key, 'other');
assert.equal(mix.reduce((n, g) => n + g.chargeB, 0), 55);
assert.equal(mix.reduce((n, g) => n + g.chargeA, 0), 100);
assert.equal(new Set(mix.flatMap(g => g.rowsB).map(r => r.id)).size, 10);
const negative = spendingPeriod({
  ...book,
  records: [row('credit', 'October', -50)]
}, {}, 'personal', 9, 9, now);
assert.equal(negative.total, -50);
assert.equal(negative.charges, 0);
assert.equal(spendingMix(negative, negative).length, 0);
const empty = spendingPeriod({
  ...book,
  records: []
}, {}, 'personal', 9, 9, now);
assert.equal(compareSpending(empty, b).find(g => g.label === 'Food').percent, null);
assert.equal(categoryColor('Food'), categoryColor('Food'));
assert.equal(book.records.find(r => r.id === 'a').amount, 100);
console.log('PASS snapshot math: recorded scope, transfers/plans excluded, refunds, missing amounts, zero baseline, shared Other grouping, same-period review status, matching YTD and source preservation.');
const watched = ['Misc - Online', 'Misc Retail', 'Food - Misc'];
const focusBook = {
  ...many,
  records: [...many.records, ...watched.map((label, i) => row('focus' + i, 'October', .01, label))]
};
const fp = spendingPeriod(focusBook, {}, 'personal', 9, 9, now),
  fm = spendingMix(fp, fp);
for (const label of watched) assert.ok(fm.some(g => g.label === label), 'Focus category must stay out of Other: ' + label);
assert.equal(new Set(watched.map(label => categoryColor(JSON.stringify(['personal', 'expense', label])))).size, 3);
assert.equal(categoryColor(JSON.stringify(['personal', 'expense', 'Misc - Online'])), categoryColor(JSON.stringify(['personal', 'expense', 'MISC_ONLINE'])));
assert.equal(fm.reduce((n, g) => n + g.chargeA, 0).toFixed(2), fp.charges.toFixed(2));
assert.equal(fm.flatMap(g => g.rowsA).length, focusBook.records.length);
console.log('PASS distinct stable focus colors and tiny focus categories retained without double counting.');
const foodKey = groups.find(g => g.label === 'Food').key,
  customMix = selectedSpendingMix(a, b, [foodKey]);
assert.equal(customMix.length, 1);
const ca = selectedSpendingPeriod(a, customMix, 'a'),
  cb = selectedSpendingPeriod(b, customMix, 'b');
assert.equal(ca.charges, 100);
assert.equal(ca.refunds, -20);
assert.equal(ca.total, 80);
assert.equal(cb.charges, 120);
assert.equal(selectedSpendingPeriod(a, [], 'a').charges, 0);
assert.equal(a.rows.length, 2);
assert.notEqual(customMix[0].color, categoryColor(foodKey));
assert.equal(selectedSpendingMix(a, b, ['absent']).length, 0);
console.log('PASS selected-category totals, refunds, empty choices, accent colors and unchanged full-period data.');
