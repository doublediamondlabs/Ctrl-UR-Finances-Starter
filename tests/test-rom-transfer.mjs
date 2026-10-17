import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
import { prepareTravelExport, previewTravelReturn, visitSnapshot } from '../app/Source/romTransfer.js';
const v = {
  id: 'visit-1',
  date: '2026-11-05',
  purpose: 'Initial inspection',
  outcome: 'Scheduled',
  vehicle: 'Van',
  miles: 200,
  charge: 'included',
  quotedFee: null,
  note: 'Original visit note'
};
const profile = {
  customerName: 'Synthetic Customer',
  customerPhone: '555-0100',
  customerEmail: 'test@example.invalid',
  vin: '001234',
  rvYear: '2024',
  rvMake: 'Example',
  rvModel: 'Trailer',
  locationType: 'dealer',
  dealerName: 'Synthetic Dealer',
  address: '1 Example Road',
  city: 'Anna',
  state: 'IL',
  zip: '01234',
  quotedFee: 1200
};
const record = {
  id: 'job-1',
  month: 'November',
  sheet: 'November',
  kind: 'inspection',
  category: 'Inspection',
  subCategory: '',
  description: 'Synthetic Customer',
  location: '',
  amount: 0,
  miles: null,
  state: 'recorded',
  scope: 'business',
  isNew: true
};
const fixture = {
  year: 2026,
  records: [record],
  notes: [{
    id: 'note-1',
    recordId: 'job-1',
    text: 'Source note',
    storage: 'app',
    sheet: 'November',
    cell: 'New entry'
  }],
  inspectionLedger: {
    sharedVersion: 1,
    jobs: {
      'job-1': {
        ownerYear: 2026,
        status: 'Scheduled',
        date: '2026-11-05',
        vehicle: 'Van',
        miles: null,
        reason: 'Office note',
        profile,
        visits: [v, {
          ...v,
          id: 'visit-2',
          date: '2026-11-20',
          purpose: 'Repair verification',
          miles: 20,
          destination: {
            dealerName: 'Different Branch',
            address: '2 Other Road',
            city: 'Murray',
            state: 'KY',
            zip: '42071'
          }
        }]
      }
    },
    events: [{
      id: 'payment',
      jobId: 'job-1',
      date: '2026-10-15',
      type: 'payment',
      amount: 500,
      method: 'Check',
      note: 'Deposit',
      paidBy: 'Synthetic Payer'
    }],
    payouts: [],
    retired: [],
    sources: [record],
    linkedYears: [2026]
  }
};
const original = JSON.stringify(fixture),
  ex = prepareTravelExport(fixture, 'job-1', 'visit-1');
assert.equal(JSON.stringify(fixture), original);
assert.match(ex.packet.inspection.destination, /01234/);
assert.match(ex.packet.inspection.contacts, /555-0100/);
assert.match(ex.packet.inspection.notes, /Source note/);
const result = {
  format: 'double-diamond-trip-results',
  version: 1,
  linkId: ex.packet.linkId,
  generation: ex.packet.generation,
  jobId: 'job-1',
  visitId: 'visit-1',
  tripId: 'trip-1',
  actualMiles: 204,
  notes: 'Travel complete'
};
const preview = previewTravelReturn(ex.next, result);
assert.equal(preview.after.miles, 204);
assert.equal(preview.after.outcome, 'Scheduled');
assert.equal(preview.next.inspectionLedger.jobs['job-1'].visits[1].miles, 20);
assert.deepEqual(preview.next.inspectionLedger.events, fixture.inspectionLedger.events);
assert.match(preview.after.note, /Original visit note/);
assert.match(preview.after.note, /Travel complete/);
assert.equal(previewTravelReturn(preview.next, result).already, true);
assert.throws(() => previewTravelReturn(preview.next, {
  ...result,
  actualMiles: 205
}), /already applied/);
assert.throws(() => previewTravelReturn(ex.next, {
  ...result,
  visitId: 'visit-2'
}), /does not match/);
assert.throws(() => previewTravelReturn(ex.next, {
  ...result,
  actualMiles: NaN
}), /Invalid actual/);
assert.equal(previewTravelReturn(ex.next, {
  ...result,
  actualMiles: 0,
  notes: ''
}).after.miles, 0);
assert.equal(previewTravelReturn(ex.next, {
  ...result,
  actualMiles: null
}).after.miles, 200);
for (const mutate of [b => b.inspectionLedger.jobs['job-1'].visits[0].date = '2026-11-06', b => b.inspectionLedger.jobs['job-1'].visits[0].miles = 201, b => b.inspectionLedger.jobs['job-1'].profile.address = 'Changed']) {
  const b = structuredClone(ex.next);
  mutate(b);
  assert.throws(() => previewTravelReturn(b, result), /changed after export/);
}
const fresh = prepareTravelExport(ex.next, 'job-1', 'visit-1');
assert.equal(fresh.packet.linkId, ex.packet.linkId);
assert.notEqual(fresh.packet.generation, ex.packet.generation);
assert.throws(() => previewTravelReturn(fresh.next, result), /superseded/);
const follow = prepareTravelExport(fixture, 'job-1', 'visit-2');
assert.notEqual(follow.packet.linkId, ex.packet.linkId);
assert.match(follow.packet.inspection.destination, /Different Branch/);
const cross = structuredClone(ex.next);
cross.year = 2027;
cross.records = [];
cross.notes = [];
cross.inspectionLedger.sources = [{
  ...record,
  notes: fixture.notes
}];
assert.deepEqual(visitSnapshot(cross, 'job-1', 'visit-1'), ex.packet.inspection);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.fixture = fixture;
w.URL.createObjectURL = blob => {
  w.downloaded = blob;
  return 'blob:test';
};
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () {
  w.filename = this.download;
};
w.eval(bundleHarness('qa-rom-transfer.jsx'));
const wait = () => new Promise(r => setTimeout(r, 35));
await wait();
const button = t => [...w.document.querySelectorAll('button')].find(b => b.textContent === t);
[...w.document.querySelectorAll('button')].find(b => b.textContent.includes('Send an Inspection to RōM')).click();
await wait();
const select = w.document.querySelector('select');
select.value = 'job-1|visit-1';
select.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
assert.match(w.document.body.textContent, /Synthetic Dealer/);
w.failSave = true;
button('Save Link & Export to RōM').click();
await wait();
assert.equal(w.downloaded, undefined);
w.failSave = false;
button('Save Link & Export to RōM').click();
await wait();
assert.ok(w.saved);
assert.match(w.filename, /Expense-Book-to-RoM/);
const stored = w.saved.inspectionLedger.jobs['job-1'].visits[0].romExport;
const ret = {
  ...result,
  linkId: stored.linkId,
  generation: stored.generation
};
async function upload(p) {
  const input = w.document.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', {
    value: [{
      size: 100,
      text: async () => JSON.stringify(p)
    }],
    configurable: true
  });
  input.dispatchEvent(new w.Event('change', {
    bubbles: true
  }));
  await wait();
}
const saves = w.attempts;
await upload(ret);
assert.equal(w.attempts, saves);
assert.match(w.document.body.textContent, /200 → 204/);
button('Cancel Preview').click();
await wait();
assert.equal(w.attempts, saves);
await upload(ret);
button('Apply Trip Results').click();
await wait();
assert.equal(w.saved.inspectionLedger.jobs['job-1'].visits[0].miles, 204);
await upload(ret);
assert.match(w.document.body.textContent, /already applied/);
const base = w.codec.blankBook(2026),
  b = w.codec.readBook(base, 2026, true);
Object.assign(b, structuredClone(w.saved));
const round = w.codec.readBook(w.codec.writeBook(base, b), 2026, true);
assert.equal(round.inspectionLedger.jobs['job-1'].visits[0].romExport.linkId, stored.linkId);
assert.equal(round.inspectionLedger.jobs['job-1'].visits[0].romReceipt.actualMiles, 204);
assert.equal(round.inspectionLedger.events[0].amount, 500);
assert.equal(round.inspectionLedger.events[0].paidBy, 'Synthetic Payer');
w.close();
console.log('PASS RōM export, correct visit, stale/duplicate protection, actual mileage, financial preservation, previews, failed-save no export and workbook roundtrip.');
