import React, { useState } from "react";
import { MONTHS, entries, totals, buckets, change, completion, reportCSV } from "./analytics.js";
const cash = n => Number(n).toLocaleString("en-US", {
  style: "currency",
  currency: "USD"
});
function Delta({
  value,
  base
}) {
  const d = change(value, base);
  return <span>{d.amount > 0 ? "+" : ""}{cash(d.amount)} <small>({d.percent === null ? "no base percentage" : (d.percent > 0 ? "+" : "") + d.percent.toFixed(1) + "%"})</small></span>;
}
function YearComparison({
  books,
  settings,
  errors,
  loading,
  onReload,
  onBack,
  onEditEntry,
  initialView = {},
  allowBusiness = true
}) {
  const sorted = [...books].sort((a, b) => a.year - b.year),
    [baseYear, setBaseYear] = useState(initialView.year || null),
    [selected, setSelected] = useState(null),
    [scope, setScope] = useState(allowBusiness ? initialView.scope || "personal" : "personal"),
    [start, setStart] = useState(initialView.start ?? 0),
    [end, setEnd] = useState(initialView.end ?? 11),
    [sub, setSub] = useState(false),
    [expanded, setExpanded] = useState(null),
    [detail, setDetail] = useState(null);
  const base = sorted.find(b => b.year === baseYear) || sorted[0],
    choices = sorted.filter(b => b !== base),
    chosen = choices.filter(b => selected === null || selected.includes(b.year));
  const summarize = b => {
      const rows = entries(b, settings, scope, start, end);
      return {
        book: b,
        rows,
        ...totals(rows),
        reviewed: MONTHS.slice(start, end + 1).filter((_, i) => completion(b, settings, scope, start + i) === "Reconciled").length
      };
    },
    data = base ? [summarize(base), ...chosen.map(summarize)] : [],
    baseline = data[0],
    max = Math.max(1, ...data.flatMap(d => [Math.abs(d.income), Math.abs(d.expense)])),
    count = end - start + 1;
  function reset(fn) {
    setExpanded(null);
    setDetail(null);
    fn();
  }
  function open(title, items) {
    setDetail({
      title,
      items
    });
  }
  function download() {
    const url = URL.createObjectURL(new Blob([reportCSV(data.flatMap(d => d.rows))], {
        type: "text/csv;charset=utf-8"
      })),
      a = document.createElement("a");
    a.href = url;
    a.download = "Double-Diamond-Selected-Year-Comparison.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  return <section className="panel year-comparison-page"><div className="report-orientation"><section className="report-orientation-controls"><h2>Compare Years</h2><div className="report-controls"><label>View<select value={scope} onChange={e => reset(() => setScope(e.target.value))}>{allowBusiness && <option value="business">Business</option>}<option value="personal">Personal</option>{allowBusiness && <option value="combined">Combined</option>}</select></label><label>From month<select value={start} onChange={e => reset(() => {
              const n = +e.target.value;
              setStart(n);
              if (n > end) setEnd(n);
            })}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label><label>Through month<select value={end} onChange={e => reset(() => {
              const n = +e.target.value;
              setEnd(n);
              if (n < start) setStart(n);
            })}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label><label><input type="checkbox" checked={sub} onChange={e => reset(() => setSub(e.target.checked))} />Show subcategories</label></div><div className="summary-actions"><button onClick={() => onBack({
            scope,
            start,
            end,
            year: base?.year
          })}>Back To Year-End Summary</button><button disabled={loading} onClick={onReload}>Reload Linked Years</button><button disabled={!base || loading} onClick={download}>Export Selected Years CSV</button><button onClick={() => window.print()}>Print / Save PDF</button></div></section><section className="report-orientation-status"><h3>{MONTHS[start]}–{MONTHS[end]} in every selected year</h3><p>Each selected year is compared individually against the base year. Recorded entries only; planned entries and transfers are excluded.</p><p>Unreconciled or empty years may be incomplete. A staged 2027 workbook does not represent a completed year.</p>{loading && <p role="status">Loading linked workbooks…</p>}{errors.map(e => <p className="error" role="alert" key={e.year}>{e.year}: {e.error} · unavailable for comparison</p>)}</section></div>
 {!base ? <p>Link a yearly workbook to begin.</p> : <><div className="month-picker"><label>Base year<select value={base.year} onChange={e => reset(() => {
            const y = +e.target.value;
            setBaseYear(y);
            setSelected((selected ?? choices.map(b => b.year)).filter(n => n !== y));
          })}>{sorted.map(b => <option key={b.year}>{b.year}</option>)}</select></label><fieldset><legend>Compare these years against the base</legend><div className="month-checkboxes">{sorted.map(b => <label key={b.year}><input type="checkbox" disabled={b.year === base.year} checked={chosen.some(c => c.year === b.year)} onChange={() => reset(() => {
                const ids = chosen.map(c => c.year);
                setSelected(ids.includes(b.year) ? ids.filter(y => y !== b.year) : [...ids, b.year]);
              })} />{b.year}{b.year === base.year ? " (base)" : ""}</label>)}</div><button onClick={() => reset(() => setSelected(choices.map(b => b.year)))}>Select All</button> <button onClick={() => reset(() => setSelected([]))}>Clear</button></fieldset></div>{!choices.length && <p className="notice">Link another annual workbook to compare years.</p>}<p><strong>{chosen.length ? "Comparing " + chosen.map(b => b.year).join(", ") + " against " + base.year + " (base year)." : "Choose one or more years to compare against " + base.year + "."}</strong></p><div className="month-comparison-grid">{data.map(d => <article className={"month-compare-card " + (d.book === base ? "base-month" : "")} key={d.book.year}><h3>{d.book.year}{d.book === base ? " \xB7 Base" : ""}</h3><span className={d.reviewed === count ? "balance-positive" : "report-incomplete"}>{d.reviewed} / {count} months reconciled</span><details><summary>Review status by month</summary>{MONTHS.slice(start, end + 1).map((m, i) => <p key={m}>{m}: {completion(d.book, settings, scope, start + i)}</p>)}</details>{!d.rows.length && <p>No recorded entries — incomplete or no activity; verify before drawing conclusions.</p>}{d.missing > 0 && <button onClick={() => open(d.book.year + " missing amounts", d.rows.filter(r => !Number.isFinite(r.amount)))}>Show {d.missing} Missing Amounts</button>}{["income", "expense", "net"].map(k => <div className="month-measure" key={k}><div><span>{k === "income" ? "Income" : k === "expense" ? "Spending" : "Surplus / deficit"}</span><button className={"report-amount " + (k === "net" ? d[k] < 0 ? "balance-negative" : "balance-positive" : "")} onClick={() => open(d.book.year + " " + k, k === "net" ? d.rows : d.rows.filter(r => r.flow === k))}>{cash(d[k])}</button></div>{k !== "net" && <span className={"visual-bar-track bar-" + k} aria-hidden="true"><span style={{
                width: Math.abs(d[k]) / max * 100 + "%"
              }} /></span>}{d.book !== base && <small>Versus {base.year}: <Delta value={d[k]} base={baseline[k]} /></small>}</div>)}{d.book !== base && <button aria-expanded={expanded === d.book.year} onClick={() => setExpanded(expanded === d.book.year ? null : d.book.year)}>{expanded === d.book.year ? "Hide Category Changes" : "Show Category Changes"}</button>}</article>)}</div><p className="hint">Bars share a scale and show magnitude. Signed amounts include refunds; percentage change is unavailable for a zero base.</p>{expanded !== null && (() => {
        const target = data.find(d => d.book.year === expanded);
        if (!target) return null;
        const a = buckets(baseline.rows, sub),
          b = buckets(target.rows, sub),
          keys = [...new Set([...a, ...b].map(g => g.key))].sort((x, y) => Math.abs((b.find(g => g.key === y)?.total || 0) - (a.find(g => g.key === y)?.total || 0)) - Math.abs((b.find(g => g.key === x)?.total || 0) - (a.find(g => g.key === x)?.total || 0)));
        return <div className="table-wrap"><h3>{expanded} against {base.year} · category changes</h3><table><thead><tr><th>Area / category</th><th>{base.year} · base</th><th>{expanded}</th><th>Change</th></tr></thead><tbody>{keys.map(k => {
                const ag = a.find(g2 => g2.key === k),
                  bg = b.find(g2 => g2.key === k),
                  g = ag || bg;
                return <tr key={k}><th>{g.domain === "business" ? "Business" : "Personal"} · {g.flow} · {g.label}</th><td><button className="report-amount" onClick={() => open(base.year + " " + g.label, ag?.rows || [])}>{cash(ag?.total || 0)}</button></td><td><button className="report-amount" onClick={() => open(expanded + " " + g.label, bg?.rows || [])}>{cash(bg?.total || 0)}</button></td><td><Delta value={bg?.total || 0} base={ag?.total || 0} /></td></tr>;
              })}</tbody></table>{!keys.length && <p>No recorded categories for either year.</p>}</div>;
      })()}</>}
 {detail && <section className="report-detail" aria-label="Year comparison entries"><h3>{detail.title}</h3><button onClick={() => setDetail(null)}>Close Entries</button>{!detail.items.length && <p>No recorded entries for this total.</p>}{detail.items.map(r => <article key={r.year + ":" + r.id}><strong>{r.description || r.category} · {Number.isFinite(r.amount) ? cash(r.amount) : "Missing amount"}</strong><p>{r.year} · {r.month} · {r.category} · {r.subcategory}</p><button onClick={() => onEditEntry(r.year, r.id)}>Edit This Entry</button>{r.notes.map((n, i) => <p key={i}>{n}</p>)}</article>)}</section>}</section>;
}
export { YearComparison as default };
