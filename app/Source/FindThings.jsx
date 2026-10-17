import { normalize } from './sharedInspections.js';
import React, { useState, useEffect, useRef } from 'react';
import { indexBook, findThings, searchSnippet } from './findThings.js';
import { MONTHS } from './analytics.js';
export default function FindThings({
  links,
  api,
  readBook,
  onOpen,
  state,
  onState,
  busy,
  modules = {
    business: true
  }
}) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [errors, setErrors] = useState([]),
    [loaded, setLoaded] = useState([]),
    [page, setPage] = useState(1);
  const serial = useRef(0);
  const {
    query = '',
    scope = 'all',
    year = 'all'
  } = state;
  async function load() {
    const token = ++serial.current;
    setLoading(true);
    setErrors([]);
    setRows([]);
    setLoaded([]);
    const next = [],
      failed = [],
      years = [];
    for (const y of Object.keys(links).sort()) {
      try {
        const r = await api('workbook?year=' + y);
        next.push(...indexBook(normalize(readBook(r.base64, Number(y), true))));
        years.push(y);
      } catch (e) {
        failed.push(y + ': ' + e.message);
      }
      if (token !== serial.current) return;
    }
    setRows(next);
    setErrors(failed);
    setLoaded(years);
    setLoading(false);
  }
  useEffect(() => {
    load();
    return () => {
      serial.current++;
    };
  }, [JSON.stringify(links)]);
  function change(p) {
    onState({
      ...state,
      ...p
    });
    setPage(1);
  }
  const matches = findThings(rows.filter(r => modules.business || r.domain !== 'business'), query, scope, year),
    visible = matches.slice(0, page * 50);
  return <section className="panel find-things"><h2>Find That Thing</h2><p className="hint">Search descriptions, inspection customer/dealer details, locations, visit notes and workbook notes across linked years. Planned entries are included and labeled. Search stays on this computer.</p><div className="find-controls"><label>What are you looking for?<input autoFocus type="search" placeholder="Dealer, purchase, customer, or words from a note…" value={query} onChange={e => change({
          query: e.target.value
        })} /></label><label>Area<select value={scope} onChange={e => change({
          scope: e.target.value
        })}><option value="all">All areas</option>{modules.business && <option value="business">Business</option>}<option value="personal">Personal</option><option value="notes">Standalone notes</option></select></label><label>Year<select value={year} onChange={e => change({
          year: e.target.value
        })}><option value="all">All linked years</option>{Object.keys(links).sort().map(y => <option key={y}>{y}</option>)}</select></label><button disabled={loading || busy} onClick={load}>Refresh Search</button></div>{loading ? <p role="status">Reading linked workbooks…</p> : <><p className="hint">Searched {loaded.length} of {Object.keys(links).length} linked years{loaded.length ? ': ' + loaded.join(', ') : ''}. Refresh after changes in another window.</p>{errors.length > 0 && <div role="alert" className="notice"><strong>Some years could not be searched. Results are incomplete.</strong>{errors.map(e => <p key={e}>{e}</p>)}</div>}{!query.trim() ? <p>Enter a few words to find an entry. Every word must appear somewhere in the result.</p> : <><p role="status">{matches.length} {matches.length === 1 ? 'match' : 'matches'}{errors.length ? ' in the available years' : ''}.</p>{visible.map(r => <article className="find-result" key={r.year + ':' + r.type + ':' + r.id}><div><strong>{r.title}</strong><small>{r.domain === 'personal' ? 'Personal / Household' : r.domain === 'business' ? 'Business' : r.domain === 'both' ? 'Business & Personal' : 'Workbook Notes'} → {r.year} → {MONTHS[r.month]} → {r.category}{r.state === 'planned' ? ' · Planned' : ''}</small><p>{searchSnippet(r, query)}</p></div><button disabled={busy} onClick={() => onOpen(r)}>Open {r.type === 'note' ? 'Note' : r.type === 'transfer' ? 'Transfer' : 'Entry'}</button></article>)}{matches.length > visible.length && <button onClick={() => setPage(page + 1)}>Show 50 More</button>}</>}</>}</section>;
}
