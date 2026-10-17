import React, { useState, useEffect } from 'react';
import { MONTHS, entries, totals, buckets, change, completion, sum } from './analytics.js';
const cash = n => Number(n).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
});
const definitions = [['business', 'income', 'Business income'], ['business', 'expense', 'Business expenses'], ['personal', 'income', 'Personal income'], ['personal', 'expense', 'Personal expenses']];
const statusClass = s => s === 'Reconciled' ? 'balance-positive' : 'report-incomplete';
function Delta({
  current,
  base
}) {
  const d = change(current, base);
  return <span>{d.amount > 0 ? '+' : ''}{cash(d.amount)} <small>({d.percent === null ? 'no base percentage' : (d.percent > 0 ? '+' : '') + d.percent.toFixed(1) + '%'})</small></span>;
}
function Bar({
  value,
  max,
  kind = 'category'
}) {
  return <span className={'visual-bar-track bar-' + kind} aria-hidden="true"><span style={{
      width: Math.abs(value) / Math.max(1, max) * 100 + '%'
    }} /></span>;
}
export function FlowSummary({
  rows,
  transfers,
  scope,
  year,
  start,
  end,
  sub,
  onOpen,
  comparisonTable
}) {
  const [selected, setSelected] = useState(''),
    [all, setAll] = useState(false);
  const tabs = definitions.filter(d => scope === 'combined' || d[0] === scope).map(([domain, flow, label]) => ({
    key: domain + ':' + flow,
    domain,
    flow,
    label
  }));
  tabs.push({
    key: 'transfers',
    label: 'Transfers'
  });
  const active = tabs.find(t => t.key === selected) || tabs[0];
  useEffect(() => {
    setAll(false);
  }, [selected, scope, year, start, end, sub]);
  const groups = buckets(rows.filter(r => r.domain === active.domain && r.flow === active.flow), sub).sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.label.localeCompare(b.label)),
    total = sum(groups.map(g => ({
      amount: g.total
    }))),
    max = Math.max(1, ...groups.map(g => Math.abs(g.total))),
    transferTotal = sum(transfers),
    shown = all ? groups : groups.slice(0, 6),
    missing = totals(rows.filter(r => r.domain === active.domain && r.flow === active.flow)).missing;
  const routes = [...new Set(transfers.map(t => t.from + ' → ' + t.to))];
  return <section className="flow-summary"><h3>Where money came from and went</h3><button className="transfer-rollup" onClick={() => setSelected('transfers')}><strong>Transfers: {cash(transferTotal)}</strong><span>{transfers.length} {transfers.length === 1 ? "Transaction" : "Transactions"} · {routes.length === 1 ? routes[0] : routes.length + ' account routes'}</span><small>Money Moved Between Accounts · Excluded From Income, Spending And Surplus/Deficit</small></button><div className="visual-tabs" role="tablist" aria-label="Money flow sections">{tabs.map((t, i) => <button role="tab" id={'flow-tab-' + t.key} aria-controls="flow-panel" aria-selected={active.key === t.key} tabIndex={active.key === t.key ? 0 : -1} key={t.key} onClick={() => setSelected(t.key)} onKeyDown={e => {
        let n;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') n = (i + tabs.length - 1) % tabs.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = tabs.length - 1;
        if (n !== undefined) {
          e.preventDefault();
          setSelected(tabs[n].key);
          document.getElementById('flow-tab-' + tabs[n].key)?.focus();
        }
      }}>{t.label}</button>)}</div><div id="flow-panel" role="tabpanel" aria-labelledby={'flow-tab-' + active.key}><p className="hint">{year} · {MONTHS[start]}–{MONTHS[end]} · {active.label}</p>{active.key === 'transfers' ? <><h4>{cash(transferTotal)} moved · {transfers.length} transactions</h4>{!transfers.length && <p>No transfers entered for this area and period.</p>}<div className="visual-transfer-list">{[...transfers].sort((a, b) => a.date.localeCompare(b.date)).map(t => <article key={t.id}><div><strong>{t.from} → {t.to}</strong><strong>{cash(t.amount)}</strong></div><small>{t.date} · {t.scope === 'both' ? 'Business & Personal' : t.scope === 'business' ? 'Business' : 'Personal'}</small>{t.note && <details><summary>Notes</summary><p className="preserve-lines">{t.note}</p></details>}</article>)}</div></> : <><div className="visual-totals"><div><small>Section total</small><strong>{cash(total)}</strong></div><div><small>Categories{sub ? ' / subcategories' : ''}</small><strong>{groups.length}</strong></div><div><small>Largest by amount</small><strong>{groups[0]?.label || 'No recorded entries'}</strong></div></div>{missing > 0 && <p className="notice">{missing} recorded entries have missing amounts. Displayed totals are incomplete.</p>}<div className="category-bars">{shown.map(g => <button key={g.key} onClick={() => onOpen(g.label + ' · ' + year, g.rows)}><span className="bar-label">{g.label}</span><Bar value={g.total} max={max} /><span className="bar-value">{cash(g.total)}<small>{total > 0 ? (g.total / total * 100).toFixed(1) + '% of net total' : "Share Unavailable"}</small></span></button>)}</div>{!groups.length && <p>No recorded entries for this section and period.</p>}{groups.length > 6 && <button onClick={() => setAll(!all)}>{all ? "Show Top Six" : 'Show all ' + groups.length + ' categories'}</button>}<p className="hint">Select a category to view its entries. Bar length shows magnitude; signed amounts and net shares include refunds.</p></>}</div>{comparisonTable && <details className="year-category-details"><summary>Category totals & changes across both years</summary>{comparisonTable}</details>}</section>;
}
export function MonthComparison({
  book,
  settings,
  scope,
  sub,
  onOpen
}) {
  const [base, setBase] = useState(0),
    [chosen, setChosen] = useState([1]),
    [expanded, setExpanded] = useState(null);
  useEffect(() => {
    setExpanded(null);
  }, [base, chosen, book, settings, scope, sub]);
  const months = chosen.filter(m => m !== base).sort((a, b) => a - b),
    data = [base, ...months].map(m => {
      const rows = entries(book, settings, scope, m, m);
      return {
        m,
        rows,
        ...totals(rows),
        state: completion(book, settings, scope, m)
      };
    }),
    baseline = data[0],
    max = Math.max(1, ...data.flatMap(d => [Math.abs(d.income), Math.abs(d.expense)]));
  function toggle(m) {
    setChosen(chosen.includes(m) ? chosen.filter(v => v !== m) : [...chosen, m]);
  }
  return <section className="month-comparison"><h3>Month versus month · {book.year}</h3><div className="month-picker"><label>Base month<select value={base} onChange={e => {
          const m = +e.target.value;
          setBase(m);
          setChosen(chosen.filter(v => v !== m));
        }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label><fieldset><legend>Compare these months against the base</legend><div className="month-checkboxes">{MONTHS.map((m, i) => <label key={m}><input type="checkbox" disabled={i === base} checked={i !== base && chosen.includes(i)} onChange={() => toggle(i)} />{m}{i === base ? ' (base)' : ''}</label>)}</div><button type="button" onClick={() => setChosen(MONTHS.map((_, i) => i).filter(i => i !== base))}>Select All</button> <button type="button" onClick={() => setChosen([])}>Clear</button></fieldset></div><p><strong>{months.length ? 'Comparing ' + months.map(m => MONTHS[m]).join(', ') + ' against ' + MONTHS[base] + ' (base month).' : 'Choose one or more months to compare against ' + MONTHS[base] + '.'}</strong></p><p className="hint">This comparison uses the months checked here and the selected Business/Personal view. Each month is compared separately with the base; the From/Through range applies to the other summaries.</p><div className="month-comparison-grid">{data.map(d => <article className={'month-compare-card ' + (d.m === base ? 'base-month' : '')} key={d.m}><h4>{MONTHS[d.m]}{d.m === base ? ' · Base' : ''}</h4><span className={statusClass(d.state)}>{d.state}</span>{!d.rows.length && <p className="hint">No recorded entries — not proof of no activity.</p>}{d.missing > 0 && <button className="missing-amounts-link" onClick={() => onOpen(MONTHS[d.m] + ' · missing amounts', d.rows.filter(r => !Number.isFinite(r.amount)))}>Show {d.missing} Missing Amounts</button>}{['income', 'expense'].map(k => <div className="month-measure" key={k}><div><span>{k === 'income' ? 'Income' : 'Spending'}</span><button className="report-amount" onClick={() => onOpen(MONTHS[d.m] + ' ' + k, d.rows.filter(r => r.flow === k))}>{cash(d[k])}</button></div><Bar value={d[k]} max={max} kind={k} />{d.m !== base && <small>Versus base: <Delta current={d[k]} base={baseline[k]} /></small>}</div>)}<div className="month-net"><span>Surplus / deficit</span><strong className={d.net < 0 ? 'balance-negative' : 'balance-positive'}>{cash(d.net)}</strong>{d.m !== base && <small>Versus base: <Delta current={d.net} base={baseline.net} /></small>}</div>{d.m !== base && <button onClick={() => setExpanded(expanded === d.m ? null : d.m)} aria-expanded={expanded === d.m}>{expanded === d.m ? "Hide Category Changes" : "Show Category Changes"}</button>}</article>)}</div><p className="hint">Bars share one scale and show magnitude. Signed amounts include refunds. Planned entries and transfers are excluded.</p>{expanded !== null && (() => {
      const target = data.find(d => d.m === expanded);
      if (!target) return null;
      const a = buckets(baseline.rows, sub),
        b = buckets(target.rows, sub),
        keys = [...new Set([...a.map(g => g.key), ...b.map(g => g.key)])].sort((x, y) => Math.abs((b.find(g => g.key === y)?.total || 0) - (a.find(g => g.key === y)?.total || 0)) - Math.abs((b.find(g => g.key === x)?.total || 0) - (a.find(g => g.key === x)?.total || 0)));
      return <div className="table-wrap"><h4>{MONTHS[expanded]} against {MONTHS[base]} · category changes</h4><table><thead><tr><th>Area / category</th><th>{MONTHS[base]} · base</th><th>{MONTHS[expanded]}</th><th>Change</th></tr></thead><tbody>{keys.map(k => {
              const ag = a.find(g => g.key === k),
                bg = b.find(g => g.key === k),
                g = ag || bg;
              return <tr key={k}><th>{g.domain === 'business' ? 'Business' : 'Personal'} · {g.flow} · {g.label}</th><td><button className="report-amount" onClick={() => onOpen(g.label + ' · ' + MONTHS[base], ag?.rows || [])}>{cash(ag?.total || 0)}</button></td><td><button className="report-amount" onClick={() => onOpen(g.label + ' · ' + MONTHS[expanded], bg?.rows || [])}>{cash(bg?.total || 0)}</button></td><td><Delta current={bg?.total || 0} base={ag?.total || 0} /></td></tr>;
            })}</tbody></table>{!keys.length && <p>No recorded categories in either month.</p>}</div>;
    })()}</section>;
}
