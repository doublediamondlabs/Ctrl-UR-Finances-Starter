import { bundleHarness } from './helpers.mjs';
const testBundle = bundleHarness('qa-rearview.jsx');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { rearviewStats, emptyRearview } from '../app/Source/rearview.js';
const b = {
  year: 2026,
  records: [{
    id: 'legacy',
    kind: 'inspection',
    state: 'recorded',
    month: 'March',
    miles: 15,
    scope: 'business',
    description: 'SECRET CUSTOMER',
    amount: 999
  }],
  inspectionLedger: {
    jobs: {
      a: {
        ownerYear: 2026,
        visits: [{
          id: 'a1',
          date: '2026-01-01',
          outcome: 'Completed',
          miles: 10
        }, {
          id: 'a2',
          date: '2026-02-01',
          outcome: 'Partially completed',
          miles: 20
        }, {
          id: 'a3',
          date: '2026-12-01',
          outcome: 'Scheduled',
          miles: 500
        }]
      },
      b: {
        ownerYear: 2026,
        entryType: 'travel',
        visits: [{
          id: 'b1',
          date: '2026-01-01',
          outcome: 'Completed',
          miles: 1000
        }]
      }
    },
    events: [],
    retired: []
  }
};
const s = rearviewStats(b);
assert.equal(s.inspections, 2);
assert.equal(s.miles, 45);
assert.equal(s.months[0].inspections, 1);
assert.equal(s.months[1].inspections, 1);
assert.equal(s.months[11].inspections, 0);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'dangerously',
  url: 'http://localhost'
}).window;
w.book = b;
w.confirm = () => true;
let saved = null;
w.api = async (path, body) => {
  if (body) {
    if (w.fail) throw Error('Test save failure');
    saved = body.data;
    return {
      data: saved,
      revision: 'next'
    };
  }
  return {
    data: saved,
    revision: 'initial'
  };
};
w.print = () => {
  w.printed = true;
  w.dispatchEvent(new w.Event('afterprint'));
};
w.eval(testBundle);
const wait = () => new Promise(r => setTimeout(r, 40));
for (let attempt = 0; attempt < 50 && !w.document.querySelector('.rearview-editor-month'); attempt++) await wait();
const d = w.document,
  btn = t => [...d.querySelectorAll('button')].find(x => x.textContent === t);
assert.equal(d.querySelectorAll('.rearview-editor-month').length, 12);
assert.ok([...d.querySelectorAll('details')].every(x => !x.open));
const input = d.querySelector('input[maxlength="100"]');
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, 'Our year');
input.dispatchEvent(new w.Event('input', {
  bubbles: true
}));
await wait();
assert.equal(w.dirty, true);
assert.equal(btn('Print / Save as PDF').disabled, true);
w.fail = true;
btn('Save Yearbook').click();
await wait();
assert.match(d.querySelector('[role=alert]').textContent, /Test save failure/);
assert.equal(input.value, 'Our year');
w.fail = false;
btn('Save Yearbook').click();
await wait();
assert.equal(saved.title, 'Our year');
assert.equal(w.dirty, false);
btn('Preview Yearbook').click();
await wait();
assert.match(d.querySelector('.rearview-recap').textContent, /Our year/);
assert.ok(!d.querySelector('.rearview-printout').textContent.includes('SECRET CUSTOMER'));
assert.ok(!d.querySelector('.rearview-printout').textContent.includes('999'));
btn('Print / Save as PDF').click();
assert.equal(w.printed, true);
assert.equal(d.body.classList.contains('printing-rearview'), false);
const cover = d.querySelector('.rearview-cover');
assert.ok(cover);
assert.equal(cover.tagName, 'DIV');
assert.equal(d.querySelector('.rearview-recap>header'), null);
const style = d.createElement('style');
style.textContent = fs.readFileSync(new URL('../app/web/style.css', import.meta.url), 'utf8');
d.head.append(style);
assert.equal(w.getComputedStyle(cover).height, 'auto');
assert.equal(w.getComputedStyle(cover.querySelector('h1')).overflowWrap, 'anywhere');
w.close();
console.log('PASS rollups, repeat visits, scheduled and other-travel exclusion, month disclosure, draft/save failure, preview privacy and print lifecycle.');
