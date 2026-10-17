import React from 'react';
import { createRoot } from 'react-dom/client';
import OverviewUtilities from '../app/Source/OverviewUtilities.jsx';
import { lockLinks } from '../app/Source/LinkGuard.jsx';
window.lockLinks = lockLinks;
createRoot(document.getElementById('root')).render(<OverviewUtilities years={<div className="year-tabs"><button onClick={() => window.yearChosen = 2026}>2026</button></div>} backup={{
  state: 'amber',
  label: 'Backup needs attention'
}} backupDetails={<p>Backup details</p>} onRecovery={() => window.recovery = true} />);
