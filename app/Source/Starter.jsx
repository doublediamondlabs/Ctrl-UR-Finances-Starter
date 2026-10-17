import ExitApp from './ExitApp.jsx';
import React, { useEffect, useState } from 'react';
import { blankBook, readBook, writeBook } from './workbook.js';
import { setShared } from './sharedInspections.js';
export const accents = {
  ocean: '#176b80',
  forest: '#286344',
  plum: '#70427d',
  slate: '#41536b',
  rust: '#934723'
};
export const moduleOptions = [['move', 'Move & Housing Planner', 'Compare current-home and new-home cash needs with your own estimates.'], ['business', 'Business Finance', 'Business receipts, recurring and variable expenses, and reporting.'], ['inspections', 'Inspections & Travel', 'Customer jobs, visits, mileage, dated payments/refunds and bank connections. Requires Business Finance.'], ['rom', 'RōM Travel Exchange', 'Optional file exchange with the separate RōM travel planner. Requires Inspections & Travel; leave off if you do not use RōM.'], ['loans', 'Loan Tracking', 'Track money you owe, principal and interest, and connect existing expenses.'], ['family', 'Family Repayments', 'A separate zero-interest repayment ledger, receipt history and monthly statements.']];
export function StarterGate({
  api,
  children
}) {
  const [state, setState] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    api('preferences').then(setState).catch(e => setError(e.message));
  }, []);
  if (error) return <main className="starter-screen"><h1>Ctrl Ur Finances</h1><p className="error">{error}</p><button onClick={() => location.reload()}>Retry</button></main>;
  if (!state) return <main className="starter-screen">Opening your local workspace…</main>;
  return state.initialized ? children(state) : <Setup api={api} state={state} onDone={setState} />;
}
function Setup({
  api,
  state,
  onDone
}) {
  const [name, setName] = useState('My household'),
    [year, setYear] = useState(new Date().getFullYear()),
    [folder, setFolder] = useState(state.dataDirectory),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setShared(null);
      const base64 = blankBook(Number(year));
      const result = await api('setup', {
        householdName: name,
        year: Number(year),
        dataDirectory: folder,
        base64
      });
      onDone(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <main className="starter-screen"><header><span>Welcome to Ctrl Ur Finances</span><div className="header-exit"><ExitApp api={api} blocked={busy} /></div></header><div className="starter-welcome"><span className="eyebrow">CTRL UR FINANCES · EXPERIMENTAL</span><h1>A home for your household finances.</h1><p>Start with income, spending and transfers. Add business and loan tools when you need them.</p><p className="hint">No account, subscription or internet connection is required to use this app.</p></div><form className="panel starter-setup" onSubmit={save}><fieldset disabled={busy}><legend>Create your household</legend><label>Household name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>Starting calendar year<input type="number" required min="1900" max="2200" value={year} onChange={e => setYear(e.target.value)} /></label><label>Data folder<input required value={folder} onChange={e => setFolder(e.target.value)} /></label><button type="button" onClick={async () => {
          try {
            const r = await api('pick-data-directory', {});
            if (r.path) setFolder(r.path);
          } catch (e) {
            setError(e.message);
          }
        }}>Choose empty folder</button><p className="hint">Setup entries are saved when you choose Create household. Your new workbook, settings and backups go here. The default User-Data folder keeps them separate from program files. Choose an empty folder; existing files will not be replaced.</p>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Creating workspace…' : 'Create household'}</button></fieldset></form><p className="starter-footer">Developed by Double Diamond Labs — Adventure On!<br />v3.32.53-alpha.2 · Separate test installation only</p></main>;
}
export async function prepareLogo(file) {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) throw Error('Choose a PNG or JPEG image smaller than 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(Error('This image could not be opened.'));
      i.src = url;
    });
    if (img.width > 8192 || img.height > 8192) throw Error('Choose a logo no larger than 8192 × 8192 pixels.');
    const scale = Math.min(1, 512 / Math.max(img.width, img.height)),
      canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function Preferences({
  state,
  api,
  onSaved,
  onDirty
}) {
  const [draft, setDraft] = useState(() => structuredClone(state.preferences)),
    [logo, setLogo] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.preferences) || logo !== null;
  useEffect(() => {
    onDirty(dirty || busy);
    return () => onDirty(false);
  }, [dirty, busy]);
  function change(p) {
    setSaved('');
    setDraft(d => ({
      ...d,
      ...p
    }));
  }
  function toggle(id, value) {
    const modules = {
      ...draft.modules,
      [id]: value
    };
    if (id === 'inspections' && value) modules.business = true;
    if (id === 'rom' && value) {
      modules.business = true;
      modules.inspections = true;
    }
    if (id === 'business' && !value) {
      modules.inspections = false;
      modules.rom = false;
    }
    if (id === 'inspections' && !value) modules.rom = false;
    change({
      modules
    });
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('preferences', {
        revision: state.revision,
        preferences: draft,
        ...(logo ? {
          logoBase64: logo
        } : {})
      });
      onSaved(r);
      setDraft(structuredClone(r.preferences));
      setLogo(null);
      setSaved('Settings saved. Your financial records are unchanged.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <form className="preferences-form" onSubmit={save}><fieldset disabled={busy}><section className="panel"><h2>Modules</h2><p>Home & Personal Finance is always available. Enable extra tools as needed; disable them to hide their screens while keeping their records and backups.</p><div className="module-grid"><article className="module-card core"><h3>Home & Personal Finance</h3><p>Income, household expenses, transfers, reconciliation and summaries.</p><strong>Always enabled</strong></article>{moduleOptions.map(([id, title, description]) => <label className={'module-card ' + (draft.modules[id] ? 'enabled' : '')} key={id}><span><input type="checkbox" checked={draft.modules[id]} onChange={e => toggle(id, e.target.checked)} /><strong>{title}</strong></span><p>{description}</p><small>{draft.modules[id] ? 'Enabled' : 'Available to enable'}</small></label>)}</div><p className="hint">Enabling Inspections also enables Business. Turning Business off also hides Inspections and RōM. RōM is off by default; enabling it also enables Business and Inspections. These switches organize your workspace; they are not passwords or access controls.</p></section><section className="panel"><h2>Appearance</h2><div className="form-grid"><label>Household name<input required maxLength={100} value={draft.householdName} onChange={e => change({
              householdName: e.target.value
            })} /></label><label>Dashboard title<input required maxLength={60} value={draft.title} onChange={e => change({
              title: e.target.value
            })} /></label><label>Tagline<input required maxLength={100} value={draft.tagline} onChange={e => change({
              tagline: e.target.value
            })} /></label><label>Accent color<select value={draft.accent} onChange={e => change({
              accent: e.target.value
            })}>{Object.keys(accents).map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label></div><div className="appearance-preview" style={{
          borderColor: accents[draft.accent]
        }}>{logo || draft.logo ? <img alt="Logo preview" src={logo ? 'data:image/png;base64,' + logo : '/logo.png?v=' + state.revision} /> : <span className="default-logo-preview" aria-label="Default double diamond logo">◇◇</span>}<div><strong>{draft.title}</strong><p>{draft.tagline}</p></div></div><label>Your logo (PNG or JPEG)<input type="file" accept="image/png,image/jpeg" onChange={async e => {
            const file = e.target.files[0];
            if (!file) return;
            setBusy(true);
            setError('');
            try {
              setLogo(await prepareLogo(file));
              setSaved('');
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }} /></label><p className="hint">The app resizes a copy for display. Your uploaded logo stays local and is included in backups and portable copies.</p><button type="button" onClick={() => {
          setLogo(null);
          change({
            logo: ''
          });
        }}>Use Double Diamond logo</button> <button type="button" onClick={() => {
          setLogo(null);
          change({
            title: 'Ctrl Ur Finances',
            tagline: 'Your money, in view',
            accent: 'ocean',
            logo: ''
          });
        }}>Restore appearance defaults</button><p className="developer-credit">Developed by <strong>Double Diamond Labs</strong> — Adventure On!</p></section><section className="panel"><h2>Your data</h2><p>{state.dataDirectory}</p><p>Changing appearance or modules never deletes financial records. Use Backup & recovery or Create-Portable-Copy when moving the application and its data.</p></section>{error && <p className="error" role="alert">{error}</p>}{saved && <p className="success" role="status">{saved}</p>}<div className="preferences-actions"><button className="primary" disabled={busy || !dirty}>Save settings</button><button type="button" disabled={busy} onClick={() => {
          setDraft(structuredClone(state.preferences));
          setLogo(null);
          setError('');
          setSaved('');
        }}>Discard changes</button><button type="button" disabled={busy} onClick={async () => {
          if (dirty && !confirm('Discard unsaved settings and reload?')) return;
          try {
            const r = await api('preferences');
            onSaved(r);
            setDraft(structuredClone(r.preferences));
            setLogo(null);
            setError('');
            setSaved('');
          } catch (e) {
            setError(e.message);
          }
        }}>Reload settings</button></div></fieldset></form>;
}
