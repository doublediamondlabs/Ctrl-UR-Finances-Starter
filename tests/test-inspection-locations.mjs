import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bundleHarness } from './helpers.mjs';
import { activityData } from '../app/Source/businessReports.js';
import { inspectionLocations, locationTotals, inspectionLocationCSV } from '../app/Source/dealerVisits.js';
const privateLocation = {
  locationType: 'private',
  city: 'Anna',
  state: 'IL',
  address: '123 Private Lane',
  zip: '01234'
};
const dealer = {
  locationType: 'dealer',
  dealerName: 'Synthetic Dealer',
  city: 'Anna',
  state: 'IL',
  address: '1 Store Road'
};
const v = (id, date, miles, patch = {}) => ({
  id,
  date,
  miles,
  vehicle: 'Van',
  purpose: 'Initial inspection',
  outcome: 'Completed',
  ...patch
});
const jobs = {
  a: {
    ownerYear: 2026,
    profile: {
      ...privateLocation,
      customerName: 'Synthetic Alice',
      rvYear: '2024',
      rvMake: 'Example',
      rvModel: 'Trailer'
    },
    visits: [v('a1', '2026-01-02', 50), v('a2', '2026-02-02', 60, {
      purpose: 'Other follow-up',
      destination: privateLocation
    }), v('a3', '2026-03-02', 70, {
      purpose: 'Other follow-up',
      destination: dealer,
      vehicle: 'Truck'
    }), v('a4', '2026-04-02', 50, {
      outcome: 'Scheduled'
    }), v('a5', '2027-01-02', 50)]
  },
  b: {
    ownerYear: 2026,
    profile: {
      ...privateLocation,
      city: ' ANNA ',
      address: '456 Different St',
      customerName: 'Synthetic Bob'
    },
    visits: [v('b1', '2026-02-02', null)]
  },
  travel: {
    ownerYear: 2026,
    entryType: 'travel',
    travelReview: 'reviewed',
    visits: [v('t1', '2026-02-04', 20, {
      purpose: 'Other travel',
      destination: {
        locationType: 'private',
        city: 'Elsewhere',
        state: 'IL',
        address: '7 Lane'
      }
    })]
  },
  unknown: {
    ownerYear: 2026,
    profile: {
      customerName: 'Unknown'
    },
    visits: [v('u1', '2026-02-05', 30, {
      purpose: 'Other follow-up'
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
const snapshot = JSON.stringify(book),
  trips = activityData(book).trips,
  data = inspectionLocations(book, trips);
assert.equal(data.groups.length, 1);
assert.equal(data.privateGroups.length, 2);
assert.equal(data.privateGroups[0].rows.length, 3);
assert.equal(data.privateGroups[0].missingMiles, 1);
assert.deepEqual(locationTotals(data.privateGroups), {
  jobs: 2,
  visits: 4,
  miles: 130,
  missingMiles: 1
});
assert.deepEqual(locationTotals([...data.groups, ...data.privateGroups]), {
  jobs: 2,
  visits: 5,
  miles: 200,
  missingMiles: 1
});
assert.equal(data.excluded, 1);
assert.equal(data.review.length, 1);
assert.equal(inspectionLocations(book, trips, 'Truck').privateGroups.length, 0);
assert.equal(locationTotals(inspectionLocations(book, activityData(book, 1, 1).trips).privateGroups).visits, 3);
assert.ok(data.privateGroups[0].rows[0].visitAddress.includes('01234'));
assert.ok(inspectionLocationCSV(data).some(row => row[0] === 'All Locations' && row[1] === 2 && row[2] === 5));
assert.ok(inspectionLocationCSV(data).some(row => row[0] === 'Synthetic Alice' && row.includes('123 Private Lane, Anna, IL, 01234')));
assert.equal(JSON.stringify(book), snapshot);
const w = new JSDOM('<div id="root"></div>', {
  runScripts: 'outside-only',
  url: 'http://localhost'
}).window;
w.book = book;
w.trips = trips;
w.eval(bundleHarness('qa-inspection-locations.jsx'));
const wait = () => new Promise(r => setTimeout(r, 40));
await wait();
const button = text => [...w.document.querySelectorAll('button')].find(b => b.textContent === text);
assert.match(w.document.querySelector('table').textContent, /Distinct Inspection Jobs/);
button('Private Sales').click();
await wait();
assert.equal(w.document.querySelectorAll('[aria-label="Private-sale areas"] button').length, 2);
assert.ok([...w.document.querySelectorAll('.manufacturer-records details')].every(d => !d.open));
assert.match(w.document.querySelector('.manufacturer-records').textContent, /Synthetic Alice/);
assert.match(w.document.querySelector('.manufacturer-records').textContent, /2024 Example Trailer/);
assert.match(w.document.querySelector('.manufacturer-records').textContent, /123 Private Lane/);
button('Open Record').click();
assert.equal(w.opened.id, 'a');
assert.equal(w.opened.activityDate, '2026-01-02');
const select = w.document.querySelector('select');
select.value = 'Truck';
select.dispatchEvent(new w.Event('change', {
  bubbles: true
}));
await wait();
assert.match(w.document.body.textContent, /No confirmed private-sale visits/);
button('Dealers').click();
await wait();
assert.match(w.document.querySelector('.manufacturer-records').textContent, /Synthetic Dealer/);
w.close();
console.log('PASS private-sale city grouping, distinct jobs versus visits, mixed-type job deduplication, mileage-only exclusion from jobs, month/vehicle/year filters, missing mileage, CSV, unchanged source, compact tabs, collapsed months and open record.');
