import React from 'react';
import { createRoot } from 'react-dom/client';
import Recovery from '../app/Source/Recovery.jsx';
window.calls = [];
async function api(route, body) {
  window.calls.push({
    route,
    body
  });
  if (route === 'backup/status') return {
    state: 'neutral',
    label: 'Backup recorded · current files not rechecked',
    completedAt: '2026-10-16T12:00:00',
    path: 'C:/Backups/synthetic.zip',
    destination: 'C:/Backups'
  };
  if (route === 'backup/retention') return {
    enabled: true,
    history: []
  };
  if (route === 'backup/preview') return {
    path: body.path,
    revision: 'synthetic',
    created: '2026-10-16',
    version: 'test',
    fileCount: 10,
    links: []
  };
  if (route === 'backup/create') return {
    state: 'running',
    startedAt: 'test',
    phase: 'Preparing',
    total: 0
  };
  return {};
}
createRoot(document.getElementById('root')).render(<Recovery api={api} onDirty={() => {}} />);
