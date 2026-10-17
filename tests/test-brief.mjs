import { bundleHarness } from './helpers.mjs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const w = new JSDOM('<div id="root"></div>', {
  url: 'http://localhost',
  runScripts: 'outside-only'
}).window;
w.structuredClone = structuredClone;
let fail = false;
let calls = [];
const profile = {
  customerName: 'Synthetic Customer',
  customerPhone: '555-0100 ext. 2',
  vin: '0001-OLD',
  rvMake: 'Test RV',
  rvModel: 'Model',
  appointmentId: 'A123',
  address: 'Initial only',
  city: 'Anna',
  state: 'IL'
};
const jobs = {
  '2026|one': {
    profile,
    ownerYear: 2026,
    visits: [{
      id: 'v1',
      purpose: 'Initial inspection',
      date: '2026-10-13',
      outcome: 'Scheduled',
      destination: {
        id: 'north',
        name: 'North',
        address: '100 Dealer Lane',
        zip: '01234-5678',
        city: 'Anna',
        state: 'IL'
      }
    }, {
      id: 'v2',
      purpose: 'Repair verification',
      date: '2026-10-13',
      outcome: 'Scheduled',
      note: 'Check repair'
    }, {
      id: 'v3',
      date: '',
      purpose: 'Initial inspection'
    }]
  },
  '2026|travel': {
    entryType: 'travel',
    visits: [{
      id: 't',
      date: '2026-10-13'
    }]
  }
};
const registry = {
  sharedVersion: 1,
  linkedYears: [2026],
  jobs,
  events: [],
  payouts: [],
  retired: [],
  sources: []
};
w.api = async route => {
  calls.push(route);
  if (fail) throw Error('Workbook unavailable');
  return route === 'years' ? {
    reporting: {
      savedDestinations: [{
        id: 'north',
        name: 'North Branch',
        reminder: 'Call Sam: synthetic contact'
      }]
    }
  } : {
    shared: registry,
    books: []
  };
};
let prints = 0;
w.print = () => prints++;
w.eval(bundleHarness('qa-brief.jsx'));
const sleep = () => new Promise(r => setTimeout(r, 90));
await sleep();
const d = w.document;
const set = (el, v) => {
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new w.Event('input', {
    bubbles: true
  }));
};
set(d.querySelector('input[type=date]'), '2026-10-13');
await sleep();
const button = t => [...d.querySelectorAll('button')].find(x => x.textContent === t);
assert.equal(d.querySelector('.period-disclosure-toggle').getAttribute('aria-expanded'), 'false');
d.querySelector('.period-disclosure-toggle').click();
await sleep();
assert.match(d.cookie, /dd-period-test=open/);
assert.equal(d.querySelector('#dd-period-test').hidden, false);
assert.equal(d.querySelectorAll('.brief-choices input').length, 2);
assert.equal(d.querySelectorAll('.inspection-brief-printout article').length, 2);
assert.match(d.body.textContent, /1 visit\(s\) have no date/);
button('Preview Selected').click();
await sleep();
assert.match(d.querySelector('.brief-preview').textContent, /Call Sam/);
assert.match(d.querySelector('.brief-preview').textContent, /555-0100 ext. 2/);
assert.match(d.querySelector('.brief-preview').textContent, /0001-OLD/);
assert.match(d.querySelector('.brief-preview').textContent, /01234-5678/);
assert.ok(w.rows(registry, []).rows.every(r => !r.missing.some(x => /phone|vin/i.test(x))));
const blankRegistry = structuredClone(registry);
delete blankRegistry.jobs['2026|one'].profile.customerPhone;
delete blankRegistry.jobs['2026|one'].profile.vin;
assert.ok(w.rows(blankRegistry, []).rows.every(r => !r.missing.some(x => /phone|vin/i.test(x))));
const rows = w.rows(registry, []);
assert.equal(rows.rows.find(r => r.visitId === 'v2').location, null);
assert.ok(rows.rows.find(r => r.visitId === 'v2').missing.includes('Street address'));
assert.equal(rows.rows.length, 2);
d.querySelector('.brief-choices input').click();
await sleep();
assert.equal(d.querySelectorAll('.inspection-brief-printout article').length, 1);
button('Print / Save as PDF').click();
assert.equal(prints, 1);
assert.ok(d.body.classList.contains('printing-inspection-brief'));
w.dispatchEvent(new w.Event('afterprint'));
assert.ok(!d.body.classList.contains('printing-inspection-brief'));
fail = true;
button('Refresh Inspections').click();
await sleep();
assert.match(d.querySelector('[role=alert]').textContent, /Workbook unavailable/);
assert.equal(d.querySelectorAll('.inspection-brief-printout article').length, 0);
assert.equal(button('Print / Save as PDF').disabled, true);
assert.ok(calls.every(r => ['years', 'inspection/context'].includes(r)));
w.close();
console.log('PASS brief: dated visits, follow-up location safety, current reminders, undated warning, exclusions, selection, print cleanup, read-only loading, failed refresh clears printout, period toggle and cookie.');
