import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
import { customerContacts, withCustomers, validateCustomers } from '../app/Source/customerContacts.js';
import { indexBook, findThings } from '../app/Source/findThings.js';
import { inspectionLabel } from '../app/Source/inspectionDetails.js';
const legacy = {
  customerName: 'Alex Smith',
  customerPhone: '555-1111',
  customerEmail: 'alex@example.test',
  city: 'Anna',
  state: 'IL',
  locationType: 'private'
};
const before = JSON.stringify(legacy);
assert.equal(customerContacts(legacy)[0].phones[0].value, '555-1111');
assert.equal(JSON.stringify(legacy), before);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.profile = legacy;
w.confirm = () => true;
w.eval(bundleHarness('qa-customer-contacts.jsx'));
const wait = () => new Promise(r => setTimeout(r, 40));
await wait();
const button = (label, root = w.document) => [...root.querySelectorAll('button')].find(b => b.textContent === label);
async function input(el, value) {
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new w.Event('input', {
    bubbles: true
  }));
  await wait();
}
button('Add Phone Number').click();
await wait();
await input(w.document.querySelectorAll('input[type=tel]')[1], '555-2222');
button('Make Preferred').click();
await wait();
assert.equal(w.currentProfile.customerPhone, '555-2222');
button('Add Email Address').click();
await wait();
await input(w.document.querySelectorAll('input[type=email]')[1], 'alex.work@example.test');
button('Add Another Customer').click();
await wait();
const second = w.document.querySelectorAll('.customer-contact-card')[1];
await input(second.querySelector('input'), 'Jamie Jones');
button('Add Phone Number', second).click();
await wait();
await input(second.querySelector('input[type=tel]'), '555-3333');
button('Add Email Address', second).click();
await wait();
await input(second.querySelector('input[type=email]'), 'jamie@example.test');
const p = JSON.parse(JSON.stringify(w.currentProfile));
validateCustomers(p);
assert.equal(p.customers.length, 2);
assert.equal(p.customers[0].phones.length, 2);
assert.equal(p.customers[0].emails.length, 2);
assert.match(inspectionLabel(p), /Alex Smith & Jamie Jones/);
const brief = w.document.querySelector('.inspection-brief-sheet');
assert.match(brief.textContent, /jamie@example.test/);
assert.match(brief.textContent, /555-2222 · Preferred/);
assert.match(brief.querySelectorAll('.brief-person')[1].textContent, /Jamie Jones.*555-3333.*jamie@example.test/s);
const base = w.codec.blankBook(2026),
  book = w.codec.readBook(base, 2026, true);
book.records.push({
  id: 'one',
  month: 'January',
  sheet: 'January',
  kind: 'inspection',
  category: 'Inspection',
  subCategory: '',
  description: 'Alex Smith',
  amount: 0,
  miles: null,
  state: 'recorded',
  scope: 'business',
  isNew: true
});
book.inspectionLedger = {
  jobs: {
    one: {
      ownerYear: 2026,
      profile: p,
      status: 'Scheduled',
      vehicle: '',
      miles: null,
      visits: []
    }
  },
  events: [],
  payouts: [],
  retired: [],
  sources: []
};
const round = w.codec.readBook(w.codec.writeBook(base, book), 2026, true);
assert.equal(JSON.stringify(round.inspectionLedger.jobs.one.profile.customers), JSON.stringify(p.customers));
assert.equal(Object.keys(round.inspectionLedger.jobs).length, 1);
const rows = indexBook(round);
for (const query of ['Jamie Jones', '555-3333', 'alex.work@example.test', 'jamie@example.test']) assert.equal(findThings(rows, query).length, 1, query);
assert.throws(() => validateCustomers(withCustomers(p, [{
  name: 'Alex',
  phones: [{
    value: '',
    label: '',
    preferred: true
  }],
  emails: []
}])));
assert.throws(() => validateCustomers(withCustomers(p, [{
  name: 'Alex',
  phones: [],
  emails: [{
    value: 'invalid',
    label: '',
    preferred: true
  }]
}])));
button('Remove Customer').click();
await wait();
assert.equal(w.currentProfile.customers.length, 1);
assert.equal(w.currentProfile.customerPhone, '555-2222');
w.close();
console.log('PASS legacy preservation, multiple people/methods, preferred aliases, removal, brief grouping, searchable contacts and workbook roundtrip without duplicate jobs.');
