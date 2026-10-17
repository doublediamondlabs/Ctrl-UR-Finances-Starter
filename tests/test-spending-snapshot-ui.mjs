import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
const w = new JSDOM('<div id="root"></div>', {
  url: 'http://localhost',
  runScripts: 'outside-only'
}).window;
const RealDate = w.Date;
w.Date = class extends RealDate {
  constructor(...a) {
    super(...(a.length ? a : [2026, 9, 16]));
  }
};
w.eval(bundleHarness('qa-spending-snapshot.jsx'));
const wait = () => new Promise(r => setTimeout(r, 50));
await wait();
await wait();
const d = w.document,
  button = t => [...d.querySelectorAll('button')].find(x => x.textContent === t && !x.closest('[hidden]'));
const set = (label, value) => {
  const l = [...d.querySelectorAll('label')].find(x => x.firstChild.textContent === label),
    s = l.querySelector('select');
  s.value = value;
  s.dispatchEvent(new w.Event('change', {
    bubbles: true
  }));
};
assert.equal(button('Spending Mix').getAttribute('aria-pressed'), 'true');
assert.equal(d.querySelector('.snapshot-tabs button').textContent, 'Spending Mix');
assert.equal(d.querySelectorAll('.snapshot-donut svg').length, 2);
button('Choose Categories').click();
await wait();
const foodChoice = [...d.querySelectorAll('.snapshot-category-checks label')].find(x => x.textContent === 'Food');
assert.ok(foodChoice);
foodChoice.querySelector('input').click();
await wait();
assert.match(d.querySelector('.snapshot-donut').textContent, /Selected charges/);
assert.equal(d.querySelectorAll('.snapshot-legend li').length, 2);
assert.match(d.querySelector('.snapshot-totals').textContent, /\$170.00/);
button('Clear Categories').click();
await wait();
assert.match(d.querySelector('.snapshot-donut').textContent, /\$0.00/);
assert.match(d.body.textContent, /Choose at least one category/);
button('Default Mix').click();
await wait();
assert.equal(d.querySelector('.snapshot-category-picker'), null);
assert.doesNotMatch(d.querySelector('.snapshot-donut').textContent, /Selected charges/);
button('Compare Spending').click();
await wait();
assert.match(d.querySelector('.snapshot-totals').textContent, /\$100.00/);
assert.match(d.querySelector('.snapshot-totals').textContent, /\$170.00/);
assert.match(d.body.textContent, /partial period/);
assert.equal(d.querySelector('.snapshot-trend').hidden, true);
d.querySelector('.snapshot-category').click();
await wait();
assert.ok(d.querySelector('[aria-label="Snapshot category entries"]'));
button('Close Entries').click();
await wait();
button('Spending Mix').click();
await wait();
assert.equal(d.querySelectorAll('.snapshot-donut svg').length, 2);
assert.match(d.body.textContent, /Refunds \/ credits/);
d.querySelector('.snapshot-legend button').click();
await wait();
assert.ok(d.querySelector('.snapshot-entry'));
assert.doesNotMatch(d.querySelector('.spending-snapshot').textContent, /B minus A|A · |B · /);
assert.match(d.querySelector('.snapshot-change-periods').textContent, /October 2026 compared with September 2026/);
const periodPickers = d.querySelectorAll('.snapshot-period-picker');
assert.equal(periodPickers[0].open, false);
periodPickers[0].querySelector('summary').click();
await wait();
assert.equal(periodPickers[0].open, true);
const pick = (group, text) => [...d.querySelector('[aria-label="' + group + '"]').querySelectorAll('button')].find(b => b.textContent === text).click();
pick('Starting period month', 'August');
await wait();
assert.match(periodPickers[0].querySelector('summary').textContent, /August 2026/);
assert.match(d.querySelector('.snapshot-change-periods').textContent, /October 2026 compared with August 2026/);
pick('Starting period month', 'September');
await wait();
d.querySelector('.snapshot-legend button').click();
await wait();
periodPickers[0].querySelector('summary').click();
const readsBefore = w.reads.length;
button('Monthly Spending Trend').click();
await wait();
assert.equal(d.querySelector('.snapshot-trend').hidden, false);
assert.equal(d.querySelectorAll('.snapshot-trend-row').length, 12);
assert.equal(d.querySelector('.snapshot-totals'), null);
assert.equal(w.reads.length, readsBefore, 'Switching tabs does not refetch workbooks');
button('Historical Analysis').click();
await wait();
assert.ok(d.querySelector('.spending-snapshot').closest('[hidden]'));
assert.ok(!d.querySelector('#historical-report-panel-categories').closest('[hidden]'));
button('Monthly Review').click();
await wait();
assert.ok(!d.querySelector('#historical-report-panel-review').closest('[hidden]'));
assert.ok(button('Mark Reconciled'));
assert.ok(d.querySelector('.report-trend').closest('[hidden]'), 'Duplicate trend chart stays hidden');
button('Multi-month Comparison').click();
await wait();
assert.ok(!d.querySelector('#historical-report-panel-comparison').closest('[hidden]'));
button('Full-year Summary & Export').click();
await wait();
assert.ok(button('Export CSV'));
assert.ok(d.querySelector('.report-orientation').closest('[hidden]'));
const mainTabs = d.querySelector('[aria-label="Year-end reports"]');
mainTabs.querySelector('[aria-selected="true"]').dispatchEvent(new w.KeyboardEvent('keydown', {
  key: 'Home',
  bubbles: true
}));
await wait();
assert.equal(d.activeElement.textContent, 'Spending Snapshot');
assert.equal(button('Spending Mix').getAttribute('aria-pressed'), 'true');
assert.ok(d.querySelector('.snapshot-entry'), 'Snapshot detail and chart selection survive navigation');
for (const tab of d.querySelectorAll('[role="tab"]')) assert.ok(d.getElementById(tab.getAttribute('aria-controls')), 'Tab has a panel target');
button('Year to Date').click();
await wait();
assert.equal(d.querySelector('.snapshot-entry-detail'), null);
assert.match(d.querySelector('.snapshot-totals').textContent, /January–September 2025/);
assert.match(d.querySelector('.snapshot-totals').textContent, /January–September 2026/);
button('Print / Save PDF').click();
assert.equal(w.printed, true);
w.fail = true;
button('Reload Snapshot').click();
await wait();
await wait();
assert.match(d.body.textContent, /Synthetic unavailable workbook/);
assert.equal(d.querySelector('.snapshot-totals'), null);
assert.ok(w.reads.every(p => p.startsWith('workbook?year=')));
w.close();
console.log('PASS snapshot interface: spending mix default and first, paired bars, donut legends/detail, partial warning, matching YTD, print, unavailable-year handling and read-only requests.');
