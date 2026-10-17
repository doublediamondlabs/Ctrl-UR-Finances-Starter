import { bundleHarness } from './helpers.mjs';
const testBundle = bundleHarness('qa-find-things.jsx');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { indexBook, findThings } from '../app/Source/findThings.js';
const fixture = year => ({
  year,
  records: [{
    id: 'buy',
    kind: 'expense',
    scope: 'residence',
    category: 'House',
    month: 'March',
    description: 'Garden supplies',
    state: 'planned'
  }, {
    id: year + '|job',
    kind: 'inspection',
    scope: 'business',
    month: 'February',
    description: 'RV inspection',
    state: 'recorded'
  }],
  notes: [{
    id: 'note',
    recordId: 'buy',
    text: 'Warranty blue flowers'
  }, {
    id: 'standalone',
    sheet: 'January',
    text: 'Remember the ladder'
  }],
  transfers: [],
  inspectionLedger: {
    sharedVersion: 1,
    jobs: {
      [year + '|job']: {
        ownerYear: year,
        profile: {
          dealerName: 'Bish’s Murray',
          customerName: 'Example'
        },
        visits: []
      }
    },
    sources: [],
    events: [],
    retired: []
  }
});
const rows = [...indexBook(fixture(2025)), ...indexBook(fixture(2026))];
assert.equal(findThings(rows, 'bishs murray').length, 2);
assert.equal(findThings(rows, 'flowers', 'personal', '2025').length, 1);
assert.equal(findThings(rows, 'flowers', 'business').length, 0);
assert.equal(findThings(rows, 'ladder', 'notes').length, 2);
assert.equal(findThings(rows, '   ').length, 0);
assert.equal(findThings(rows, 'bishs')[0].year, 2026);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'dangerously',
  url: 'http://localhost'
}).window;
w.structuredClone = structuredClone;
w.api = async path => {
  const y = Number(path.split('=')[1]);
  if (y === 2024) throw Error('Workbook unavailable');
  return {
    base64: String(y)
  };
};
w.readBook = (s, y) => fixture(y);
w.eval(testBundle);
await new Promise(r => setTimeout(r, 120));
for (let i = 0; i < 50 && w.document.body.textContent.includes('Reading linked'); i++) await new Promise(r => setTimeout(r, 30));
const d = w.document;
assert.equal(d.querySelectorAll('.find-result').length, 2);
assert.match(d.querySelector('[role=alert]').textContent, /2024.*unavailable/);
d.querySelector('.find-result button').click();
assert.equal(w.opened.year, 2026);
assert.equal(w.opened.id, '2026|job');
w.close();
const source = fs.readFileSync(new URL('../app/Source/main.jsx', import.meta.url), 'utf8'),
  body = source.slice(source.indexOf('async function openFound'), source.indexOf('async function openReportEntry'));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
for (const row of [{
  type: 'entry',
  id: 'buy',
  year: 2026,
  month: 2
}, {
  type: 'entry',
  id: '2026|job',
  year: 2026,
  month: 1
}, {
  type: 'note',
  id: 'standalone',
  year: 2026,
  month: 0
}]) {
  const calls = {},
    names = [...new Set([...body.matchAll(/\b(set\w+)\(/g)].map(x => x[1]))],
    b = fixture(2026);
  const args = {
    modules: {
      business: true,
      inspections: true
    },
    leaveHousing: () => true,
    refreshShared: async () => ({}),
    api: async () => ({
      base64: 'x',
      revision: 'r'
    }),
    readBook: () => b,
    ledger: b => b.inspectionLedger,
    months: ['January', 'February', 'March'],
    structuredClone,
    ...Object.fromEntries(names.map(n => [n, v => calls[n] = v]))
  };
  await new AsyncFunction(...Object.keys(args), 'row', 'let sharedContext;' + body + '; await openFound(row);')(...Object.values(args), row);
  assert.equal(calls.setBusy, false);
  assert.ok(!calls.setError);
  assert.equal(calls.setTab, row.type === 'note' ? 'notes' : row.id === 'buy' ? 'home' : 'month');
  if (row.id === 'buy') assert.equal(calls.setEdit.id, 'buy');
  if (row.id === '2026|job') assert.equal(calls.setInspectionRequest, row.id);
}
console.log('PASS cross-year/area/note/dealer search, punctuation, unavailable-year notice, result callback and Business/Personal/note navigation.');
