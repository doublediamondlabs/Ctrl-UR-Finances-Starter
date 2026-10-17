import assert from 'node:assert/strict';
import { dealerVisits, dealerVisitCSV } from '../app/Source/dealerVisits.js';
import { activityData } from '../app/Source/businessReports.js';
import { bundleHarness } from './helpers.mjs';
import { JSDOM } from 'jsdom';
const location = {
  locationType: 'dealer',
  dealerName: 'Dealer North',
  address: '1 Main St',
  city: 'Anna',
  state: 'IL'
};
const v = (id, date, miles, patch = {}) => ({
  id,
  date,
  miles,
  vehicle: 'Truck',
  purpose: 'Initial inspection',
  outcome: 'Completed',
  ...patch
});
const jobs = {
  a: {
    ownerYear: 2026,
    profile: {
      ...location,
      customerName: 'Customer A'
    },
    visits: [v('a1', '2026-01-02', 100), v('a2', '2026-02-02', 104, {
      purpose: 'Repair verification',
      destination: {
        ...location,
        name: 'North'
      }
    }), v('a3', '2026-02-03', 80, {
      purpose: 'Repair verification'
    }), v('a4', '2026-03-02', 100, {
      outcome: 'Scheduled'
    }), v('a5', '2026-02-04', null), v('a6', '', 100), v('a7', '2027-01-02', 100)]
  },
  b: {
    ownerYear: 2026,
    profile: {
      ...location,
      address: '2 Main St',
      customerName: 'Customer B'
    },
    visits: [v('b1', '2026-01-02', 120, {
      vehicle: 'Van'
    })]
  },
  c: {
    ownerYear: 2026,
    profile: {
      locationType: 'private',
      customerName: 'Private'
    },
    visits: [v('c1', '2026-01-02', 90)]
  },
  d: {
    ownerYear: 2026,
    profile: {
      ...location,
      customerName: 'Customer D'
    },
    visits: [v('d1', '2026-01-02', 100), v('d2', '2026-04-02', 30, {
      outcome: 'Not performed'
    }), v('d3', '2026-04-03', 0, {
      outcome: 'Not performed'
    }), v('d4', '2026-04-04', 100, {
      outcome: 'Canceled'
    })]
  },
  e: {
    ownerYear: 2026,
    entryType: 'travel',
    travelReview: 'reviewed',
    visits: [v('e1', '2026-05-02', 10, {
      purpose: 'Other travel',
      destination: {
        ...location,
        name: 'North'
      }
    })]
  }
};
const book = {
  year: 2026,
  records: Object.keys(jobs).map(id => ({
    id,
    kind: 'inspection',
    month: 'January',
    description: id
  })),
  notes: [],
  inspectionLedger: {
    jobs,
    events: [],
    payouts: [],
    retired: []
  }
};
const before = JSON.stringify(book),
  trips = activityData(book).trips,
  result = dealerVisits(book, trips);
assert.equal(result.groups.length, 2);
const north = result.groups.find(g => g.address === '1 Main St');
assert.equal(north.rows.length, 6);
assert.equal(north.miles, 344);
assert.equal(north.missingMiles, 1);
assert.equal(result.excluded, 1);
assert.equal(result.review.length, 4);
assert.equal(dealerVisits(book, trips, 'Van').groups[0].rows.length, 1);
assert.equal(dealerVisits(book, activityData(book, 1, 1).trips).groups[0].rows.length, 2);
assert.ok(result.review.some(r => r.visitId === 'a3' && r.reason === 'Visit location missing'));
assert.ok(!result.groups.flatMap(g => g.rows).some(r => ['a4', 'a6', 'a7', 'c1', 'd3', 'd4'].includes(r.visitId)));
assert.equal(JSON.stringify(book), before);
// The two same-day records stay distinct: there is no shared-trip identifier.
assert.equal(north.rows.filter(r => r.inspectionDate === '2026-01-02').length, 2);
assert.ok(dealerVisitCSV(result).some(r => r[0] === 'Dealer North' && r[1] === '1 Main St' && r[4] === 6));
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.testData = result;
w.eval(bundleHarness('qa-dealer-visits.jsx'));
await new Promise(r => setTimeout(r, 80));
assert.match(w.document.body.textContent, /Recorded Dealer Visits/);
assert.ok([...w.document.querySelectorAll('details')].every(el => !el.open));
[...w.document.querySelectorAll('button')].find(b => b.textContent === 'Open Record').click();
await new Promise(r => setTimeout(r, 20));
assert.equal(w.opened.id, 'a');
assert.equal(w.opened.activityDate, '2026-01-02');
const tabs = w.document.querySelectorAll('.dealer-tabs button');
assert.equal(tabs.length, 2);
tabs[1].click();
await new Promise(r => setTimeout(r, 20));
assert.equal(tabs[1].getAttribute('aria-pressed'), 'true');
assert.match(w.document.querySelector('.manufacturer-records').textContent, /2 Main St/);
assert.equal(w.document.querySelectorAll('.manufacturer-records').length, 1);
const select = w.document.querySelector('select');
select.value = 'Van';
select.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await new Promise(r => setTimeout(r, 20));
assert.equal(select.value, 'Van');
w.close();
console.log('PASS dealer visits: annual/month/vehicle filters, recorded snapshots, separate branches, return-location safety, scheduled/private exclusions, missing details, CSV, read-only behavior, collapsed UI and open-record navigation.');
