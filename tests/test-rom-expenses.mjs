import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
import { prepareTravelExport, previewTravelReturn, applyTravelExpensePlan, assertTravelRevisions } from '../app/Source/romTransfer.js';
const categories = [{
  name: 'Fuel',
  subs: ['Van', 'Truck'],
  role: 'expense'
}, {
  name: 'Food',
  subs: [],
  role: 'expense'
}, {
  name: 'Lodging',
  subs: [],
  role: 'expense'
}, {
  name: 'Residence',
  subs: [],
  role: 'residence'
}];
const record = {
  id: 'job',
  month: 'December',
  sheet: 'December',
  kind: 'inspection',
  category: 'Inspection',
  subCategory: '',
  description: 'Synthetic job',
  location: '',
  amount: 0,
  miles: null,
  state: 'recorded',
  scope: 'business',
  isNew: true
};
const fixture = {
  year: 2026,
  categories,
  records: [record],
  notes: [],
  inspectionLedger: {
    sharedVersion: 1,
    linkedYears: [2026, 2027],
    sources: [record],
    jobs: {
      job: {
        ownerYear: 2026,
        status: 'Scheduled',
        vehicle: 'Van',
        miles: null,
        profile: {
          customerName: 'Synthetic Customer',
          locationType: 'dealer',
          dealerName: 'Example Dealer',
          city: 'Anna',
          state: 'IL',
          quotedFee: 1200
        },
        visits: [{
          id: 'visit',
          date: '2026-12-31',
          purpose: 'Initial inspection',
          outcome: 'Scheduled',
          vehicle: 'Van',
          miles: null,
          charge: 'included',
          note: ''
        }]
      }
    },
    events: [{
      id: 'payment',
      jobId: 'job',
      date: '2026-12-01',
      type: 'payment',
      amount: 500,
      note: ''
    }],
    payouts: [],
    retired: []
  }
};
const other = {
    ...structuredClone(fixture),
    year: 2027,
    records: []
  },
  ex = prepareTravelExport(fixture, 'job', 'visit', [fixture, other]);
assert.equal(ex.packet.version, 2);
assert.equal(ex.packet.expenseCatalog.length, 2);
assert.ok(ex.packet.expenseCatalog.every(y => !y.categories.some(c => c.name === 'Residence')));
const expense = (id, date, amount, category = 'Fuel') => ({
  id,
  date,
  payee: 'Synthetic Payee',
  description: 'Receipt ' + id,
  amount,
  category,
  subCategory: category === 'Fuel' ? 'Van' : '',
  bucket: 'Fuel'
});
const ret = {
  format: 'double-diamond-trip-results',
  version: 2,
  linkId: ex.packet.linkId,
  generation: ex.packet.generation,
  jobId: 'job',
  visitId: 'visit',
  tripId: 'trip',
  actualMiles: null,
  notes: '',
  expenses: [expense('one', '2026-12-30', 50), expense('two', '2027-01-01', 70)]
};
const context = {
    books: [ex.next, other],
    revisions: [{
      year: 2026,
      revision: 'old'
    }, {
      year: 2027,
      revision: 'old2'
    }]
  },
  preview = previewTravelReturn(ex.next, ret, context);
assert.equal(preview.canApply, true);
assert.equal(preview.newExpenseCount, 2);
assert.equal(preview.expenseTotal, 120);
assert.equal(preview.next.records.length, 1);
const saved = applyTravelExpensePlan(preview.next, preview.expensePlan),
  savedOther = applyTravelExpensePlan({
    ...other,
    inspectionLedger: preview.next.inspectionLedger
  }, preview.expensePlan);
assert.equal(saved.records.at(-1).month, 'December');
assert.equal(savedOther.records.at(-1).month, 'January');
assert.equal(savedOther.records.at(-1).transactionDate, '2027-01-01');
assert.equal(saved.records.at(-1).description, 'Synthetic Payee · Receipt one');
assert.deepEqual(saved.inspectionLedger.events, fixture.inspectionLedger.events);
assert.equal(previewTravelReturn(saved, ret, {
  books: [saved, savedOther]
}).already, true);
const changed = structuredClone(ret);
changed.expenses[0].amount = 51;
const blocked = previewTravelReturn(saved, changed, {
  books: [saved, savedOther]
});
assert.equal(blocked.newExpenseCount, 0);
assert.equal(blocked.canApply, false);
assert.match(blocked.expenseRows[0].problem, /already imported/);
const more = {
  ...ret,
  expenses: [expense('three', '2026-12-31', 25, 'Food')]
};
assert.equal(previewTravelReturn(saved, more, {
  books: [saved, savedOther]
}).newExpenseCount, 1);
const mileage = {
  ...ret,
  actualMiles: 300,
  notes: 'Returned',
  expenses: []
};
const withMiles = previewTravelReturn(saved, mileage, {
  books: [saved, savedOther]
});
assert.equal(withMiles.after.miles, 300);
assert.equal(previewTravelReturn(withMiles.next, more, {
  books: [saved, savedOther]
}).newExpenseCount, 1);
const duplicateBook = structuredClone(ex.next);
duplicateBook.records.push({
  id: 'existing',
  kind: 'expense',
  scope: 'business',
  state: 'recorded',
  transactionDate: '2026-12-30',
  month: 'December',
  amount: 50,
  description: 'Recorded from bank'
});
const dup = previewTravelReturn(duplicateBook, ret, {
  books: [duplicateBook, other]
});
assert.equal(dup.expenseRows[0].matches.length, 1);
assert.equal(dup.selectedIds.includes('one'), false);
const selected = previewTravelReturn(duplicateBook, ret, {
  books: [duplicateBook, other],
  selectedIds: ['one']
});
assert.equal(selected.canApply, false);
assert.equal(previewTravelReturn(duplicateBook, ret, {
  books: [duplicateBook, other],
  selectedIds: ['one'],
  acknowledgedIds: ['one']
}).newExpenseCount, 1);
const noCategory = structuredClone(other);
noCategory.categories = [];
assert.match(previewTravelReturn(ex.next, ret, {
  books: [ex.next, noCategory]
}).expenseRows[1].problem, /Category no longer/);
assert.match(previewTravelReturn(ex.next, ret, {
  books: [ex.next]
}).expenseRows[1].problem, /Link the 2027/);
assert.throws(() => previewTravelReturn(ex.next, {
  ...ret,
  expenses: [ret.expenses[0], ret.expenses[0]]
}, context), /duplicate expense IDs/);
const invalid = {
  ...ret,
  expenses: [{
    ...ret.expenses[0],
    amount: -1
  }]
};
assert.equal(previewTravelReturn(ex.next, invalid, context).canApply, false);
const stale = structuredClone(saved);
stale.inspectionLedger.jobs.job.visits[0].date = '2027-01-02';
assert.throws(() => previewTravelReturn(stale, more, {
  books: [stale, savedOther]
}), /changed after export/);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.fixture = ex.next;
w.eval(bundleHarness('qa-rom-transfer.jsx'));
const wait = () => new Promise(r => setTimeout(r, 35));
await wait();
const button = t => [...w.document.querySelectorAll('button')].find(b => b.textContent === t);
const input = w.document.querySelector('input[type=file]');
Object.defineProperty(input, 'files', {
  value: [{
    size: 100,
    text: async () => JSON.stringify({
      ...ret,
      expenses: [ret.expenses[0]]
    })
  }],
  configurable: true
});
input.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
assert.match(w.document.body.textContent, /1 Selected/);
assert.equal(w.saved, undefined);
button('Apply Trip Results').click();
await wait();
assert.equal(w.saved.records.at(-1).amount, 50);
const base = w.codec.blankBook(2026),
  b = w.codec.readBook(base, 2026, true);
Object.assign(b, structuredClone(w.saved));
const round = w.codec.readBook(w.codec.writeBook(base, b), 2026, true);
assert.equal(round.records.find(r => r.id.startsWith('rom-expense:')).transactionDate, '2026-12-30');
assert.equal(round.inspectionLedger.romExpenseReceipts.length, 1);
assert.equal(previewTravelReturn(round, {
  ...ret,
  expenses: [ret.expenses[0]]
}, {
  books: [round]
}).already, true);
assert.equal(round.inspectionLedger.events[0].amount, 500);
w.close();
console.log('PASS multi-year itemized expenses, exact category mapping, selected-only imports, possible-match confirmation, persistent duplicate blocking, receipt edits, stale source, transaction dates, workbook roundtrip and payment preservation.');
const nav = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
nav.structuredClone = structuredClone;
nav.fixture = structuredClone(fixture);
nav.fixture.records[0].month = 'January';
nav.fixture.inspectionLedger.sources[0].month = 'January';
nav.fixture.inspectionLedger.jobs.job.visits[0].date = '2026-01-05';
nav.eval(bundleHarness('qa-inspection-move.jsx'));
await wait();
const btn = t => [...nav.document.querySelectorAll('button')].find(b => b.textContent === t || b.querySelector('strong')?.textContent === t);
btn('Review Existing Records').click();
await wait();
btn('Inspections & Mileage').click();
await wait();
const shortcut = nav.document.querySelector('.inspection-summary-outcome button');
assert.equal(shortcut.textContent, 'Plan Travel in RōM');
shortcut.click();
await wait();
assert.equal(nav.document.querySelector('select').value, 'job|visit');
assert.match(nav.document.body.textContent, /Save Link & Export to RōM/);
nav.close();
console.log('PASS inspection-list RōM shortcut opens the correct preselected visit.');
assertTravelRevisions(context.revisions, preview.expensePlan);
assert.throws(() => assertTravelRevisions([{
  year: 2026,
  revision: 'old'
}, {
  year: 2027,
  revision: 'changed'
}], preview.expensePlan), /changed after/);
assert.throws(() => assertTravelRevisions([{
  year: 2026,
  revision: 'old'
}], preview.expensePlan), /changed after/);
console.log('PASS changed or unlinked secondary-year workbook blocks the prepared import.');
const direct = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
direct.structuredClone = structuredClone;
direct.fixture = structuredClone(fixture);
direct.initialTravel = true;
direct.eval(bundleHarness('qa-inspection-move.jsx'));
await wait();
assert.match(direct.document.body.textContent, /Import Travel from RōM/);
assert.equal(direct.document.querySelector('select'), null);
const sendToggle = [...direct.document.querySelectorAll('button')].find(b => b.textContent.includes('Send an Inspection to RōM'));
sendToggle.click();
await wait();
assert.equal(sendToggle.getAttribute('aria-expanded'), 'true');
const chooser = direct.document.querySelector('select');
assert.equal(chooser.value, '');
chooser.value = 'job|visit';
chooser.dispatchEvent(new direct.Event('change', {
  bubbles: true
}));
await wait();
assert.match(direct.document.body.textContent, /Save Link & Export to RōM/);
[...direct.document.querySelectorAll('button')].find(b => b.textContent.endsWith('Back')).click();
await wait();
assert.equal(direct.travelClosed, true);
assert.match(direct.document.body.textContent, /Add Inspection/);
direct.close();
console.log('PASS direct monthly travel entry and Back navigation.');
