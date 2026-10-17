import React from 'react';
import { createRoot } from 'react-dom/client';
import BackupRetention from '../app/Source/BackupRetention.jsx';
window.calls = [];
let state = {
    enabled: false,
    history: []
  },
  job = {};
let seq = 0;
window.finishScan = () => {
  job = {
    ...job,
    state: 'complete',
    result: {
      folders: [{
        folder: 'Synthetic/Expense-Book-Backups/Annual',
        kind: 'Workbook',
        keep: 10,
        remove: 20,
        bytes: 2097152
      }]
    }
  };
};
async function api(route, body) {
  window.calls.push({
    route,
    body
  });
  if (route.endsWith('/preview')) return job = {
    id: String(++seq),
    state: 'running',
    checked: 42,
    current: 'Synthetic/Archive',
    elapsedSeconds: 3
  };
  if (route.endsWith('/progress')) return job;
  if (route.endsWith('/cancel')) return job = {
    ...job,
    state: 'cancelled'
  };
  if (body) state = {
    ...state,
    enabled: body.enabled
  };
  return state;
}
createRoot(document.getElementById('root')).render(<BackupRetention api={api} />);
