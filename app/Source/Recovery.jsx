import BackupRetention from './BackupRetention.jsx';
import React, { useState, useEffect, useRef } from 'react';
import { when } from './Overview.jsx';
export default function Recovery({
  api,
  onDirty
}) {
  const seenJob = useRef(''),
    followingJob = useRef(false);
  const destinationTouched = useRef(false),
    referenceTouched = useRef(false);
  const [job, setJob] = useState(null),
    [includeUpdateArchives, setIncludeUpdateArchives] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [section, setSection] = useState(null),
    [retention, setRetention] = useState(null),
    [retentionScan, setRetentionScan] = useState(null);
  const scanRunning = retentionScan?.state === 'running';
  const toggleSection = key => setSection(value => value === key ? null : key);
  async function browse(kind, current, setValue) {
    setChoosing(true);
    await run(async () => {
      const r = await api('backup/choose', {
        kind,
        initial: current || status?.destination || status?.defaultDestination || ''
      });
      if (r.path) {
        setValue(r.path);
        if (kind === 'destination') destinationTouched.current = true;
        if (kind === 'reference') referenceTouched.current = true;
        if (kind === 'archive') {
          setPreview(null);
          setResult(null);
        }
      }
    });
    setChoosing(false);
  }
  const [status, setStatus] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [destination, setDestination] = useState(''),
    [reference, setReference] = useState(''),
    [path, setPath] = useState(''),
    [preview, setPreview] = useState(null),
    [result, setResult] = useState(null);
  useEffect(() => {
    refresh();
    let active = true;
    const poll = async () => {
      try {
        const j = await api('backup/progress');
        if (!active) return;
        setJob(j);
        if (j.state === 'running') {
          followingJob.current = true;
          setBusy(true);
        } else if (followingJob.current && j.state && seenJob.current !== j.startedAt + j.state) {
          seenJob.current = j.startedAt + j.state;
          followingJob.current = false;
          setBusy(false);
          if (j.result) setStatus(j.result);
          if (j.error) setError(j.error);
        }
      } catch (e) {
        if (active) setError('Progress connection interrupted. Keep the app command window open; progress will reconnect automatically.');
      }
    };
    poll();
    const timer = setInterval(poll, 1200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    onDirty(busy);
    return () => onDirty(false);
  }, [busy]);
  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await run(async () => {
      const r = await api('backup/status');
      setStatus(r);
      if (!referenceTouched.current && r.reference) setReference(r.reference);
      if (!destinationTouched.current) setDestination(r.destination || '');
    });
  }
  async function start(check = false) {
    followingJob.current = true;
    setBusy(true);
    setError('');
    try {
      const j = await api(check ? 'backup/check' : 'backup/create', {
        destination: destination.trim().replace(/^"|"$/g, ''),
        reference: reference.trim().replace(/^"|"$/g, ''),
        includeUpdateArchives
      });
      setJob(j);
      setResult(null);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return <div className="recovery-workspace" aria-busy={busy || scanRunning}>
 {error && <p role="alert" className="error">{error}</p>}
 {status?.cleanupWarning && <p className="notice">{status.cleanupWarning}</p>}
 <section className="panel recovery-dashboard">
  <div className="recovery-dashboard-top"><div><h2>Your Backup at a Glance</h2><span className={'status-cue cue-' + (status?.state || 'neutral')}>{status?.label || 'Loading backup status…'}</span><p className="hint">{status?.completedAt ? 'Last verified backup: ' + when(status.completedAt) : status?.created ? 'Backup recorded: ' + when(status.created) + ' · completion time unavailable' : 'No verified backup recorded yet.'}{status?.checked ? ' · Checked ' + when(status.checked) : ''}</p></div>
  <div className="recovery-actions"><button disabled={busy || scanRunning} className="primary" onClick={() => start()}>Back Up Everything Now</button><button disabled={busy || scanRunning} onClick={() => start(true)}>Check Backup Status</button></div></div>
  <p className="recovery-destination"><strong>Save to:</strong> {destination || status?.defaultDestination || 'Recovery-Backups inside this app'}</p>
  {status?.detail && <p className="error">{status.detail}</p>}
 </section>
 {job?.state === 'running' && <section className="panel recovery-progress" role="status" aria-live="polite"><h3>{job.phase}</h3><p><strong>{Math.floor((job.elapsedSeconds || 0) / 60)}m {Math.floor((job.elapsedSeconds || 0) % 60)}s elapsed</strong> · {job.done || 0} of {job.total || 0} files in this stage</p>{job.total > 0 && <progress max={job.total} value={job.done} style={{
        width: '100%'
      }} />}<p className="hint">{job.current || 'Preparing file list…'}{job.bytes > 0 ? ` · ${(job.bytes / 1048576).toFixed(1)} MB processed in this file` : ''}</p><small>Keep the app command window open. Other users should pause editing until completion.</small></section>}
 {job?.state === 'complete' && <p className="notice">Operation finished in {Math.floor((job.elapsedSeconds || 0) / 60)}m {Math.floor((job.elapsedSeconds || 0) % 60)}s.</p>}
 {busy && job?.state !== 'running' && <p role="status" className="notice">{choosing ? 'Choose a folder or file in the Windows dialog. Cancel leaves the current selection unchanged.' : 'Working locally… Keep the app command window open.'}</p>}
 {retentionScan?.state === 'failed' && section !== 'retention' && <p role="alert" className="error">Folder scan stopped: {retentionScan.error}</p>}
 {scanRunning && section !== 'retention' && <div className="entry-guidance" role="status"><strong>{retentionScan.cancelling ? 'Cancelling folder scan…' : 'Scanning backup folders…'}</strong><p>{retentionScan.elapsedSeconds || 0} seconds · {retentionScan.checked || 0} items checked. Nothing is being deleted.</p><button onClick={() => setSection('retention')}>Show Scan & Cancel Controls</button></div>}
 <div className="recovery-sections" aria-label="Backup and recovery sections">
 {[['options', 'Backup Options', 'Destination, included files & last ZIP'], ['retention', 'Backup Retention', scanRunning ? 'Folder scan in progress' : !retention ? 'Loading settings…' : retention.enabled ? 'On · automatic housekeeping' : 'Off · review before enabling'], ['restore', 'Restore a Backup', result ? 'Review copy created' : preview ? 'Verified ZIP ready for review' : 'Preview a ZIP in a separate folder']].map(([key, title, detail]) => <button key={key} type="button" aria-expanded={section === key} aria-controls={'recovery-' + key + '-panel'} onClick={() => toggleSection(key)} className={section === key ? 'active' : ''}><strong>{title}</strong><small>{detail}</small><span aria-hidden="true">{section === key ? '▾' : '▸'}</span></button>)}
 </div>
 <div id="recovery-options-panel" hidden={section !== 'options'} className="panel recovery-section-body"><fieldset disabled={busy || scanRunning}>
 <h3>Backup Options</h3><div className="recovery-fields"><div><label htmlFor="backup-destination">Backup Destination Folder</label><div className="backup-path-choice"><input id="backup-destination" placeholder="Leave blank for Recovery-Backups inside this app" value={destination} onChange={e => {
                destinationTouched.current = true;
                setDestination(e.target.value);
              }} /><button type="button" onClick={() => browse('destination', destination, setDestination)}>Browse Folders</button></div><p className="hint">Remembered after a successful backup.</p></div><div><label htmlFor="backup-reference">External Reference Folder (Optional)</label><div className="backup-path-choice"><input id="backup-reference" placeholder="Folder for bank PDFs / CSVs stored elsewhere" value={reference} onChange={e => {
                referenceTouched.current = true;
                setReference(e.target.value);
              }} /><button type="button" onClick={() => browse('reference', reference, setReference)}>Browse References</button></div><p className="hint">Leave blank when your reference files are inside the app folder.</p></div></div>
 <label className="recovery-check"><input type="checkbox" checked={includeUpdateArchives} onChange={e => setIncludeUpdateArchives(e.target.checked)} />Include Old Program-Update Archives</label>
 <div className="entry-guidance"><strong>What This Backup Includes</strong><p>The app, settings, deadlines, linked annual and loan workbooks, their automatic backup histories, and reference files inside the app folder. Add outside reference files with the optional folder above. Unsaved edits are not included.</p><p>The checkbox includes App-Update-Backups. Turning it off makes a smaller ZIP and also prevents retention cleanup of those update archives. Workbook histories and your other data folders remain included.</p></div>
 <details className="recovery-help"><summary>Exclusions & Storage Guidance</summary><div className="entry-guidance"><p>Existing full recovery ZIPs, restore review folders, dependency folders and running-session files are excluded. A backup on the same drive/share does not protect against loss of that drive/share; choose a separate destination for that protection.</p></div></details>
 {status?.path && <label>Last Verified Backup ZIP<input readOnly value={status.path} onFocus={e => e.target.select()} /></label>}
 </fieldset></div>
 <div id="recovery-retention-panel" hidden={section !== 'retention'} className="panel recovery-section-body"><fieldset disabled={busy}><BackupRetention api={api} embedded onState={setRetention} onScan={setRetentionScan} completed={job?.state === 'complete' ? job.startedAt : ''} /></fieldset></div>
 <div id="recovery-restore-panel" hidden={section !== 'restore'} className="panel recovery-section-body"><fieldset disabled={busy || scanRunning}><h3>Restore a Backup</h3><div className="entry-guidance"><strong>Preview First, Restore Separately</strong><p>Choose a ZIP created by Back Up Everything Now. Preview verifies its contents. Restore creates a separate review folder; your working workbooks and links stay in place.</p></div>
 <label htmlFor="recovery-archive">Backup ZIP</label><div className="backup-path-choice"><input id="recovery-archive" value={path} onChange={e => {
            setPath(e.target.value);
            setPreview(null);
            setResult(null);
          }} placeholder="Choose a Double-Diamond-Backup ZIP" /><button type="button" onClick={() => browse('archive', path, setPath)}>Browse Backup ZIPs</button></div>{status?.path && <button onClick={() => {
          setPath(status.path);
          setPreview(null);
          setResult(null);
        }}>Use Last Successful Backup</button>} <button disabled={!path.trim()} onClick={() => run(async () => {
          setPreview(null);
          setResult(null);
          setPreview(await api('backup/preview', {
            path
          }));
        })}>Preview Backup</button>
 {preview && <div className="backup-preview"><h3>Verified backup · {when(preview.created)}</h3><p>Application version {preview.version} · {preview.fileCount} files</p><div className="table-scroll"><table><thead><tr><th>Workbook</th><th>App entries*</th><th>Original location</th><th>Location inside restored app</th></tr></thead><tbody>{preview.links.map(l => <tr key={l.label}><td>{l.label}</td><td>{l.counts?.['DD Index'] ?? (l.counts?.['DD Loan'] != null ? l.counts['DD Loan'] + ' ledger rows' : 'Legacy workbook — count unavailable')}</td><td className="path-cell">{l.original}</td><td className="path-cell">{l.stored}</td></tr>)}</tbody></table></div><p className="hint">*Annual app-entry count includes recorded and planned entries. Loan ledger rows include settings and remittances. Counts do not indicate reconciliation or completeness.</p><p>Only restore backup files you trust. The archive includes executable app code.</p><button onClick={() => run(async () => {
            setResult(await api('backup/restore', {
              path: preview.path,
              revision: preview.revision
            }));
            setPreview(null);
          })}>Restore Into Separate Review Folder</button></div>}
 {result && <div className="notice"><strong>Review copy created</strong><p>{result.message}</p><label>Restored folder<input readOnly value={result.folder} onFocus={e => e.target.select()} /></label><p>Do not enter new financial data in two copies. Review first, then deliberately choose which installation to keep using.</p></div>}</fieldset></div></div>;
}
