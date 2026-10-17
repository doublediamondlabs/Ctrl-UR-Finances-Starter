import React, { useState } from 'react';
import { useLinksUnlocked, LinkLockBar } from './LinkGuard.jsx';
export default function OverviewUtilities({
  years,
  backup,
  backupDetails,
  busy,
  onRecovery
}) {
  const [panel, setPanel] = useState(null),
    unlocked = useLinksUnlocked();
  const toggle = key => setPanel(panel === key ? null : key);
  return <section className="overview-utilities" aria-label="Overview year and utilities"><div className="overview-utility-row">{years}<div className="overview-utility-tabs" role="group" aria-label="Overview utilities"><button type="button" aria-expanded={panel === 'backup'} aria-controls="overview-backup-panel" onClick={() => toggle('backup')}><strong>Backup &amp; Recovery</strong><small className={'utility-status ' + (backup?.state || 'neutral')}>{backup?.label || 'Status not checked'}</small><span aria-hidden="true">{panel === 'backup' ? '▴' : '▾'}</span></button><button type="button" aria-expanded={panel === 'links'} aria-controls="overview-links-panel" onClick={() => toggle('links')}><strong>Workbook Links · {unlocked ? 'Unlocked' : 'Locked'}</strong><span aria-hidden="true">{panel === 'links' ? '▴' : '▾'}</span></button></div></div><div id="overview-backup-panel" className="panel overview-utility-panel backup-overview" hidden={panel !== 'backup'}><h2>Backup &amp; Recovery</h2>{backupDetails}<button disabled={busy} onClick={onRecovery}>Open Backup &amp; Recovery</button><small>Backup dates show when files were preserved, not how far entries are reconciled.</small></div><div id="overview-links-panel" className="panel overview-utility-panel" hidden={panel !== 'links'}><LinkLockBar /><p className="hint">These controls protect workbook connections. Backups remain available while links are locked.</p></div></section>;
}
