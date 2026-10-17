import assert from 'node:assert/strict';
import { signature, completion, reviewDetails, markReconciliation } from '../app/Source/analytics.js';
const row = (id, month = 'January') => ({
  id,
  month,
  kind: 'expense',
  scope: 'residence',
  state: 'recorded',
  householdCategoryId: 'food',
  description: id,
  amount: 10,
  transactionDate: ''
});
const book = {
  year: 2026,
  records: [row('a'), row('b', 'February')],
  householdCategories: [{
    id: 'food',
    name: 'Food',
    subs: []
  }],
  incomeSources: [],
  notes: [],
  transfers: [{
    id: 't',
    date: '2026-01-01',
    scope: 'personal',
    amount: 100,
    from: 'Checking',
    to: 'Savings',
    note: ''
  }]
};
const original = JSON.stringify(book);
let settings = markReconciliation(book, {}, 'personal', 0);
settings = markReconciliation(book, settings, 'personal', 1);
assert.equal(completion(book, settings, 'personal', 0), 'Reconciled');
const changed = structuredClone(book);
changed.householdCategories[0].name = 'Groceries';
changed.notes.push({
  recordId: 'a',
  text: 'Reviewed receipt'
});
changed.transfers[0].amount = 120;
let info = reviewDetails(changed, settings, 'personal', 0);
assert.equal(info.changes.length, 2);
assert.ok(info.changes[0].fields.some(f => f.field === 'category'));
assert.ok(info.changes[0].fields.some(f => f.field === 'notes'));
assert.equal(reviewDetails(changed, settings, 'personal', 1).changes[0].fields[0].field, 'category');
changed.records.push(row('new'));
changed.records = changed.records.filter(r => r.id !== 'a');
info = reviewDetails(changed, settings, 'personal', 0);
assert.ok(info.changes.some(c => c.kind === 'Added'));
assert.ok(info.changes.some(c => c.removed));
assert.equal(JSON.stringify(book), original);
const legacy = {
  reconciled: {
    '2026:personal:0': signature(book, 'personal', 0)
  }
};
assert.equal(reviewDetails(changed, legacy, 'personal', 0).legacy, true);
assert.equal(reviewDetails(changed, legacy, 'personal', 0).changes.length, 0);
settings = markReconciliation(changed, settings, 'personal', 0);
assert.equal(completion(changed, settings, 'personal', 0), 'Reconciled');
assert.equal(reviewDetails(changed, settings, 'personal', 0).changes.length, 0);
import { defaultPlan, KNOWN_ONE_OFFS, baseline, calculate } from '../app/Source/movePlanner.js';
const p = defaultPlan();
assert.equal(p.income, '');
assert.deepEqual(p.obligations, []);
assert.deepEqual(KNOWN_ONE_OFFS, {});
assert.ok(!JSON.stringify(p).match(/Texas|Illinois|4541|Truck|Van/));
const snapshot = baseline(book, ['January', 'February']);
assert.equal(snapshot.rows[0].average, 10);
console.log('PASS generic planner defaults and baseline; reconciliation category, note, transfer, add/remove differences and legacy fallback; transactions unchanged.');
