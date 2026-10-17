import React, { useEffect, useState, useRef } from 'react';
const size = n => `${(n / 1048576).toFixed(1)} MB`;
export default function BackupRetention({
  api,
  completed,
  embedded = false,
  onState,
  onScan
}) {
  const [state, setState] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
  useEffect(() => {
    run(async () => setState(await api('backup/retention')));
  }, [completed]);
  const [scan, setScan] = useState(null);
  const applied = useRef('');
  function acceptScan(j) {
    setScan(j);
    if (j.id && j.state !== 'running' && applied.current !== j.id) {
      applied.current = j.id;
      if (j.result) setPreview(j.result);
      if (j.error) setError(j.error);
    }
  }
  useEffect(() => {
    let active = true;
    let pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const j = await api('backup/retention/progress');
        if (active) acceptScan(j);
      } catch (e) {
        if (active) setError('Folder scan progress is unavailable. Check that the app command window is still open.');
      } finally {
        pending = false;
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const scanning = scan?.state === 'running';
  async function startScan() {
    setPreview(null);
    setScan({
      state: 'running',
      checked: 0,
      elapsedSeconds: 0,
      current: ''
    });
    await run(async () => {
      try {
        acceptScan(await api('backup/retention/preview', {}));
      } catch (e) {
        setScan(null);
        throw e;
      }
    });
  }
  useEffect(() => {
    onState?.(state);
  }, [state, onState]);
  useEffect(() => {
    onScan?.(scan);
  }, [scan, onScan]);
  const Container = embedded ? 'div' : 'details';
  const latest = state?.history?.[0];
  return <Container className={embedded ? "retention-content" : "panel"}>{embedded ? <h3>Backup Retention</h3> : <summary><strong>Backup Retention · {state?.enabled ? 'On' : 'Off'}</strong>{latest ? ` · Last cleanup ${latest.day} · ${latest.files} files · ${size(latest.bytes)}` : ''}</summary>}{scanning && <div className="entry-guidance" role="status" aria-live="polite"><strong>{scan.cancelling ? 'Cancelling folder scan…' : 'Scanning backup folders…'}</strong><p>{scan.elapsedSeconds || 0} seconds · {scan.checked || 0} items checked. Nothing is being changed or deleted.</p><small style={{
        overflowWrap: 'anywhere'
      }}>{scan.current || 'Starting the scan…'}</small><p>Network folders can take longer. Cancel stops after the current file-system request returns.</p><button disabled={scan.cancelling} onClick={() => run(async () => acceptScan(await api('backup/retention/cancel', {})))}>Cancel Scan</button></div>}{scan?.state === 'cancelled' && <p role="status">Folder scan cancelled. No files were changed.</p>}{busy && !scanning && <p role="status">Loading retention settings…</p>}<fieldset disabled={busy || scanning}>
 <div className="entry-guidance"><strong>Automatic housekeeping after a verified backup</strong><p>For each workbook, loan-tracker history and inspection recovery history: keep the latest 10, all copies from the last 7 days, the newest per day through 30 days, and the newest per month through 12 months. Program updates keep the latest 3 complete sets plus all from the last 7 days. Any keep rule protects a copy.</p><p>Completed cleanup runs at most once per day after Back Up Everything Now succeeds. A stopped cleanup may retry after another successful full backup. Only recognized backups included in that ZIP can be removed. Full recovery ZIPs, portable copies, live files and unfinished recovery sets stay untouched. Excluding old program-update archives also prevents their cleanup.</p></div>
 {error && <p className="error" role="alert">{error}</p>}
 {state?.enabled ? <button onClick={() => run(async () => {
        setState(await api('backup/retention', {
          enabled: false
        }));
        setPreview(null);
      })}>Turn Retention Off</button> : <button onClick={startScan}>Review Folders & Enable</button>}
 {preview && !state?.enabled && <div><h3>First Cleanup Estimate</h3><p>Nothing is removed now. The next successful full backup captures these histories before cleanup. Counts will be recalculated then.</p><div className="table-scroll"><table><thead><tr><th>History / Folder</th><th>Keep copies / sets</th><th>Remove copies / sets</th><th>Estimated space</th></tr></thead><tbody>{preview.folders.map(f => <tr key={f.folder}><td>{f.kind}<br /><small style={{
                    overflowWrap: 'anywhere'
                  }}>{f.folder}</small></td><td>{f.keep}</td><td>{f.remove}</td><td>{size(f.bytes)}</td></tr>)}</tbody></table></div>{!preview.folders.length && <p>No eligible backup histories found.</p>}<button disabled={preview.blocked} onClick={() => run(async () => {
          setState(await api('backup/retention', {
            enabled: true,
            reviewed: true
          }));
          setPreview(null);
        })}>Enable Automatic Retention</button> <button onClick={() => setPreview(null)}>Cancel</button></div>}
 {latest && <p>Last cleanup: {latest.state} · {latest.files} files removed · {size(latest.bytes)} recovered{latest.skipped ? ` · ${latest.skipped} items skipped` : ''}. {latest.detail || ''}</p>}
 <details><summary>View Cleanup History</summary>{!state?.history?.length ? <p>No cleanup has run.</p> : state.history.map(h => <div key={h.id || h.started}><p><strong>{h.started}</strong> · {h.state} · {h.files} files · {size(h.bytes)} · {h.skipped} skipped</p><small style={{
            overflowWrap: 'anywhere'
          }}>Protected by: {h.backup}</small>{h.detail && <p>{h.detail}</p>}</div>)}</details>
 </fieldset></Container>;
}
