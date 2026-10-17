import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.eval(bundleHarness('qa-business-activity-nav.jsx'));
const wait = () => new Promise(r => setTimeout(r, 60));
await wait();
const toggle = w.document.querySelector('[aria-controls="dd-period-business-activity"]');
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
toggle.click();
await wait();
assert.match(w.document.cookie, /dd-period-business-activity=open/);
assert.equal(w.document.querySelector('[aria-controls="dd-period-sidebar"]').getAttribute('aria-expanded'), 'false');
const selects = w.document.querySelectorAll('.report-controls select');
selects[0].value = '2';
selects[0].dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
const buttons = w.document.querySelectorAll('.business-activity-nav button');
buttons[3].click();
await wait();
assert.equal(w.saved.tab, 'dealers');
assert.equal(w.saved.start, 2);
assert.equal(w.saved.end, 11);
assert.equal(buttons[3].getAttribute('aria-current'), 'page');
toggle.click();
await wait();
assert.equal(w.saved.tab, 'dealers');
assert.equal(w.saved.start, 2);
const mileage = [...w.document.querySelectorAll('[aria-label="Business report sections"] button')].find(b => b.textContent === 'Mileage');
mileage.click();
await wait();
assert.equal(w.saved.tab, 'mileage');
assert.equal(buttons[0].getAttribute('aria-current'), 'page');
w.close();
console.log('PASS independent remembered disclosures, report navigation, synchronized tabs and independent month range.');
