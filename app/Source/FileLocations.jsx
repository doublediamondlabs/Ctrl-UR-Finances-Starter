import React, { useState, useEffect } from 'react';
export default function FileLocations({
  api
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError('');
    try {
      setData(await api('locations'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return <section className="panel file-locations"><div className="panel-heading"><h2>Active files & backups</h2><button disabled={busy} onClick={load}>Refresh Locations</button></div><p>This shows the installation running this window and its linked files. Select a path to copy it into File Explorer.</p>{error && <p role="alert" className="error">{error}</p>}{data && <><label>Application folder<input readOnly value={data.app} onFocus={e => e.target.select()} /></label><label>Start-App.bat for this installation<input readOnly value={data.launcher} onFocus={e => e.target.select()} /></label><label>Connections and preferences file<input readOnly value={data.config} onFocus={e => e.target.select()} /></label>{data.files.map(f => <article key={f.label}><h3>{f.label} · {f.exists ? 'Workbook found' : 'Workbook unavailable'}</h3><label>Linked workbook<input readOnly value={f.path} onFocus={e => e.target.select()} /></label><label>Automatic workbook backup folder<input readOnly value={f.backups} onFocus={e => e.target.select()} /></label></article>)}<p className="hint">Backup folders are created when an existing workbook is saved. This page does not restore, move, delete or relink files. Use Backup & recovery in Tools & Settings to create a verified full recovery ZIP.</p></>}</section>;
}
