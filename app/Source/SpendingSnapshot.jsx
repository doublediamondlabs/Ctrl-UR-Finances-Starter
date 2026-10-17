import React, { useEffect, useMemo, useState } from 'react';
import { MONTHS, change } from './analytics.js';
import { spendingPeriod, compareSpending, spendingMix, selectedSpendingMix, selectedSpendingPeriod, categoryColor, focusCategory, money } from './spendingSnapshot.js';
function Choices({
  label,
  items,
  value,
  onChange
}) {
  return <div className="snapshot-choices" role="group" aria-label={label}>{items.map(([key, title]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{title}</button>)}</div>;
}
function PeriodPicker({
  label,
  year,
  setYear,
  month,
  setMonth,
  years,
  books,
  links,
  monthly,
  through
}) {
  return <details className="snapshot-period-picker"><summary><small>{label}</small><strong>{monthly ? MONTHS[month] + ' ' + year : through !== undefined ? 'January–' + MONTHS[through] + ' ' + year : String(year)}</strong><span aria-hidden="true">▾</span></summary><div className="snapshot-picker-options"><Choices label={label + ' year'} value={year} onChange={setYear} items={years.map(y => [y, String(y) + (!books[y] && !links[y] ? ' · not linked' : '')])} />{monthly && <Choices label={label + ' month'} value={month} onChange={setMonth} items={MONTHS.map((m, i) => [i, m])} />}</div></details>;
}
function Delta({
  current,
  base,
  incomplete
}) {
  const d = change(current, base);
  return <span>{d.amount > 0 ? '+' : ''}{money(d.amount)}<small>{incomplete ? 'Percentage unavailable · missing amounts' : d.percent === null ? 'No prior baseline' : (d.percent > 0 ? '+' : '') + d.percent.toFixed(1) + '%'}</small></span>;
}
function PeriodStatus({
  p
}) {
  return <div className="snapshot-status"><span>{p.reviewed}/{p.statuses.length} months reconciled</span>{p.current && <strong>Current month included · partial period</strong>}{p.future && <strong>Future month(s) included</strong>}{!p.rows.length && <strong>No recorded spending · verify this period</strong>}{p.missing > 0 && <strong>{p.missing} expense amount(s) missing · totals incomplete</strong>}<details><summary>Review status</summary>{p.statuses.map(s => <p key={s.month}>{MONTHS[s.month]}: {s.state}</p>)}</details></div>;
}
function Donut({
  p,
  groups,
  side,
  onOpen,
  custom = false
}) {
  let offset = 0;
  const circles = groups.map(g => {
    const amount = g[side === 'a' ? 'chargeA' : 'chargeB'],
      portion = p.charges ? amount / p.charges * 100 : 0;
    const start = offset;
    offset += portion;
    return amount > 0 ? <circle key={g.key} cx="60" cy="60" r="45" pathLength="100" fill="none" stroke={g.color || (g.key === 'other' ? '#bac3cb' : categoryColor(g.key))} strokeWidth="16" strokeDasharray={`${portion} ${100 - portion}`} strokeDashoffset={-start} /> : null;
  });
  return <article className="snapshot-mix-card"><h3>{p.label}</h3><div className="snapshot-donut"><svg viewBox="0 0 120 120" role="img" aria-label={'Spending mix for ' + p.label + '. Exact category amounts follow.'}><circle cx="60" cy="60" r="45" fill="none" stroke="#e7edf1" strokeWidth="16" /><g transform="rotate(-90 60 60)">{circles}</g></svg><div><strong>{money(p.charges)}</strong><small>{custom ? 'Selected charges' : 'Charges'}</small></div></div>{!p.charges && <p>No positive expense amounts to chart.</p>}<p className="hint">{custom ? 'Selected categories · ' : ''}Refunds / credits: {money(p.refunds)} · Net: {money(p.total)}</p>{p.missing > 0 && <p className="notice">{p.missing} amount(s) missing · chart incomplete.</p>}<ul className="snapshot-legend">{groups.map(g => {
        const amount = g[side === 'a' ? 'chargeA' : 'chargeB'];
        return <li key={g.key} className={focusCategory(g.key) ? 'snapshot-focus-category' : ''}><button onClick={() => onOpen(g)}><i style={{
              background: g.color || (g.key === 'other' ? '#bac3cb' : categoryColor(g.key))
            }} aria-hidden="true" /><span>{g.label}</span><strong>{money(amount)} <small>({p.charges ? (amount / p.charges * 100).toFixed(1) : '0.0'}%)</small></strong></button></li>;
      })}</ul></article>;
}
export default function SpendingSnapshot({
  allowBusiness = true,
  book,
  settings = {},
  links = {},
  api,
  readBook,
  section = "snapshot"
}) {
  const now = useMemo(() => new Date(), []),
    initialMonth = book.year < now.getFullYear() ? 11 : book.year === now.getFullYear() ? now.getMonth() : 0;
  const [scope, setScope] = useState('personal'),
    [mode, setMode] = useState('month'),
    [view, setView] = useState('mix'),
    [yearA, setYearA] = useState(initialMonth === 0 ? book.year - 1 : book.year),
    [yearB, setYearB] = useState(book.year),
    [monthA, setMonthA] = useState(initialMonth === 0 ? 11 : initialMonth - 1),
    [monthB, setMonthB] = useState(initialMonth),
    [through, setThrough] = useState(Math.max(0, initialMonth - 1)),
    [loaded, setLoaded] = useState({}),
    [failures, setFailures] = useState({}),
    [loading, setLoading] = useState(false),
    [reload, setReload] = useState(0),
    [detail, setDetail] = useState(null),
    [all, setAll] = useState(false);
  const [categorySelections, setCategorySelections] = useState({}),
    [categoryPicker, setCategoryPicker] = useState(false);
  const custom = Array.isArray(categorySelections[scope]),
    chosen = categorySelections[scope] || [];
  const linkKey = JSON.stringify(links);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailures({});
    setLoaded({});
    const years = [...new Set([String(book.year), ...Object.keys(links)])];
    Promise.all(years.map(async year => {
      try {
        const r = await api('workbook?year=' + year);
        return {
          year,
          book: readBook(r.base64, +year)
        };
      } catch (e) {
        return {
          year,
          error: e.message
        };
      }
    })).then(results => {
      if (!live) return;
      setLoaded(Object.fromEntries(results.filter(r => r.book).map(r => [r.year, r.book])));
      setFailures(Object.fromEntries(results.filter(r => r.error).map(r => [r.year, r.error])));
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [book, linkKey, reload]);
  const books = {
      ...(!failures[book.year] ? {
        [book.year]: book
      } : {}),
      ...loaded
    },
    years = [...new Set([book.year, ...Object.keys(links).map(Number), yearA, yearB])].sort((a, b) => a - b);
  const a = spendingPeriod(books[yearA], settings, scope, mode === 'month' ? monthA : 0, mode === 'month' ? monthA : mode === 'year' ? 11 : through, now),
    b = spendingPeriod(books[yearB], settings, scope, mode === 'month' ? monthB : 0, mode === 'month' ? monthB : mode === 'year' ? 11 : through, now),
    groups = compareSpending(a, b),
    mix = custom ? selectedSpendingMix(a, b, chosen) : spendingMix(a, b),
    max = Math.max(1, ...groups.flatMap(g => [Math.abs(g.a), Math.abs(g.b)])),
    negative = groups.some(g => g.a < 0 || g.b < 0),
    same = !!a && !!b && a.year === b.year && a.start === b.start && a.end === b.end;
  useEffect(() => {
    setDetail(null);
    setAll(false);
  }, [scope, mode, yearA, yearB, monthA, monthB, through, book, settings, loaded]);
  function setComparison(next) {
    setMode(next);
    if (next !== 'month' && yearA === yearB) setYearA(yearB - 1);
  }
  const chartA = custom ? selectedSpendingPeriod(a, mix, 'a') : a,
    chartB = custom ? selectedSpendingPeriod(b, mix, 'b') : b;
  const categoryChoices = [...groups].sort((x, y) => x.label.localeCompare(y.label));
  function selectCategories(keys) {
    setCategorySelections(v => ({
      ...v,
      [scope]: keys
    }));
    setDetail(null);
  }
  const open = g => setDetail(detail?.key === g.key ? null : {
    key: g.key,
    label: g.label,
    rowsA: g.rowsA,
    rowsB: g.rowsB
  });
  function unavailable(year) {
    return failures[year] ? year + ': ' + failures[year] : loading && links[year] ? year + ': Loading workbook…' : year + ': No linked workbook available. Link that year or choose another period.';
  }
  return <section className="panel spending-snapshot" aria-label={section === 'trend' ? 'Monthly Spending Trend' : 'Spending Snapshot'}><div className={'snapshot-orientation ' + (section === 'trend' ? 'trend-orientation' : '')}><div className="snapshot-control-center"><div className="panel-heading"><div><h2>{section === 'trend' ? 'Monthly Spending Trend' : 'Spending Snapshot'}</h2><p className="panel-copy">{section === 'trend' ? 'Month-by-month spending across the selected years.' : 'Where did it go—and what changed?'}</p></div><button disabled={loading} onClick={() => setReload(n => n + 1)}>Reload Snapshot</button></div><div className="snapshot-selector-bar"><Choices label="Spending area" value={scope} onChange={setScope} items={allowBusiness ? [["personal", "Household"], ["business", "Business"]] : [["personal", "Household"]]} />{section !== 'trend' && <Choices label="Comparison type" value={mode} onChange={setComparison} items={[["month", "Month vs. Month"], ["ytd", "Year to Date"], ["year", "Full Year"]]} />}</div><div className="snapshot-periods"><PeriodPicker label="Starting period" year={yearA} setYear={setYearA} month={monthA} setMonth={setMonthA} years={years} books={books} links={links} monthly={section !== 'trend' && mode === 'month'} through={section !== 'trend' && mode === 'ytd' ? through : undefined} /><PeriodPicker label="Comparison period" year={yearB} setYear={setYearB} month={monthB} setMonth={setMonthB} years={years} books={books} links={links} monthly={section !== 'trend' && mode === 'month'} through={section !== 'trend' && mode === 'ytd' ? through : undefined} />{section !== 'trend' && mode === 'ytd' && <details className="snapshot-period-picker"><summary><small>Both years through</small><strong>{MONTHS[through]}</strong><span aria-hidden="true">▾</span></summary><div className="snapshot-picker-options"><Choices label="Both years through" value={through} onChange={setThrough} items={MONTHS.map((m, i) => [i, m])} /></div></details>}</div></div>{a && b && section === 'snapshot' && <div className="snapshot-totals">{[[a, 'A'], [b, 'B']].map(([p, id]) => <article key={id}><h3>{p.label}</h3><strong className="snapshot-total">{money(p.total)}</strong><small>{p.missing ? 'Known spending · incomplete' : 'Net recorded spending'}</small><PeriodStatus p={p} /></article>)}<article><h3>Change in spending</h3><p className="snapshot-change-periods">{b.label} compared with {a.label}</p><strong className="snapshot-total"><Delta current={b.total} base={a.total} incomplete={a.missing + b.missing > 0} /></strong><small>{same ? 'Same period' : a.missing + b.missing ? 'Resolve missing amounts before interpreting the difference.' : b.total > a.total ? 'More recorded spending' : b.total < a.total ? 'Less recorded spending' : 'No difference in recorded spending'}</small></article></div>}</div>{loading && <p role="status" className="snapshot-help">Refreshing linked workbooks…</p>}<p className="snapshot-help">Recorded expenses only; planned entries and separate transfer records are excluded. Unreviewed periods remain included. {section === 'trend' ? 'Each selected year shows all twelve months.' : a && b ? b.label + ' is compared with ' + a.label + '. Positive changes mean more spending in ' + b.label + '.' : 'Choose two available periods to compare.'}</p>{!a && <p className="notice" role="status">{unavailable(yearA)}</p>}{!b && <p className="notice" role="status">{unavailable(yearB)}</p>}{a && b && <><div hidden={section !== 'snapshot'} className="report-section-panel">
 {same && <p className="notice">Both selections are the same period. Choose different months or years to see a change.</p>}
 <div className="snapshot-tabs" role="group" aria-label="Snapshot chart view"><button aria-pressed={view === 'mix'} className={view === 'mix' ? 'primary' : ''} onClick={() => {
            setView('mix');
            setDetail(null);
          }}>Spending Mix</button><button aria-pressed={view === 'bars'} className={view === 'bars' ? 'primary' : ''} onClick={() => {
            setView('bars');
            setDetail(null);
          }}>Compare Spending</button><button onClick={() => window.print()}>Print / Save PDF</button></div>
 {view === 'bars' ? <div><p className="snapshot-help">Largest dollar changes first. Every bar uses the same scale. Select a category to see its entries.{negative ? ' Negative totals (net refunds/credits) extend left of zero.' : ''}</p>{!groups.length && <p>No recorded expense categories in these periods.</p>}<div className="snapshot-bars">{(all ? groups : groups.slice(0, 8)).map(g => <article key={g.key}><button className="snapshot-category" aria-expanded={detail?.key === g.key} onClick={() => open(g)}><strong>{g.label}</strong><span><Delta current={g.b} base={g.a} incomplete={g.missing > 0} /></span></button>{[['A', g.a, a.label], ['B', g.b, b.label]].map(([id, value, periodLabel]) => <div className="snapshot-bar-line snapshot-period-bar" key={id}><span>{periodLabel}</span><div className={'snapshot-bar-track ' + (negative ? 'has-zero' : '')} aria-hidden="true"><i style={{
                    background: categoryColor(g.key),
                    opacity: id === 'A' ? .5 : 1,
                    width: Math.abs(value) / max * (negative ? 50 : 100) + '%',
                    left: negative ? (value < 0 ? 50 - Math.abs(value) / max * 50 : 50) + '%' : '0'
                  }} /></div><strong>{money(value)}</strong></div>)}</article>)}</div>{groups.length > 8 && <button onClick={() => setAll(!all)}>{all ? 'Show Largest Changes' : 'Show All ' + groups.length + ' Categories'}</button>}</div> : <><div className="snapshot-category-tools"><button aria-pressed={!custom} onClick={() => {
              selectCategories(null);
              setCategoryPicker(false);
            }}>Default Mix</button><button aria-expanded={categoryPicker} onClick={() => {
              if (!custom) selectCategories(categoryChoices.filter(g => focusCategory(g.key) || g.label.toLowerCase() === 'groceries').map(g => g.key));
              setCategoryPicker(!categoryPicker);
            }}>Choose Categories</button>{custom && <span>{mix.length} selected categories shown · totals above cover all spending</span>}</div>{categoryPicker && <section className="snapshot-category-picker" aria-label="Doughnut category selection"><div className="snapshot-category-checks">{categoryChoices.map(g => <label key={g.key}><input type="checkbox" checked={chosen.includes(g.key)} onChange={e => selectCategories(e.target.checked ? [...chosen, g.key] : chosen.filter(k => k !== g.key))} />{g.label}</label>)}</div><div className="snapshot-category-tools"><button onClick={() => selectCategories(categoryChoices.map(g => g.key))}>Select All Categories</button><button onClick={() => selectCategories([])}>Clear Categories</button><button onClick={() => setCategoryPicker(false)}>Done Choosing</button></div></section>}{custom ? <p className="snapshot-help">Comparing selected categories only. Each doughnut totals their positive charges; percentages are shares of that selected total. Selected refunds/credits and net amounts appear below. Totals above still include all spending. {mix.length === 0 ? 'Choose at least one category with entries in these periods.' : ''}</p> : <p className="snapshot-help">Donuts show positive expense amounts (charges), not net spending. Refunds/credits are listed separately. Both charts use the same categories and Other grouping. Misc Online (violet), Misc Retail (teal), and Food–Misc (amber) stay visible when present; other categories use muted colors. Select a legend row for entries.</p>}<div className="snapshot-mixes"><Donut p={chartA} groups={mix} side="a" onOpen={open} custom={custom} /><Donut p={chartB} groups={mix} side="b" onOpen={open} custom={custom} /></div></>}
 {detail && <section className="snapshot-entry-detail" aria-label="Snapshot category entries"><div className="panel-heading"><h3>{detail.label} · Entries</h3><button onClick={() => setDetail(null)}>Close Entries</button></div><div className="snapshot-entry-columns">{[[a, detail.rowsA, 'A'], [b, detail.rowsB, 'B']].map(([p, rows, id]) => <article key={id}><h4>{p.label}</h4>{!rows.length && <p>No recorded expenses for this category.</p>}{rows.map(r => <div className="snapshot-entry" key={r.year + ':' + r.id}><strong>{r.description || r.category}</strong><span>{Number.isFinite(r.amount) ? money(r.amount) : 'Missing amount'}</span><small>{r.transactionDate || r.month} · {r.category}{r.subcategory ? ' / ' + r.subcategory : ''}</small>{r.notes.map((n, i) => <p key={i}>{n}</p>)}</div>)}</article>)}</div></section>}
 </div><section hidden={section !== 'trend'} className="snapshot-trend report-section-panel"><div className="panel-heading"><h3>{[...new Set([yearA, yearB])].join(' / ')}</h3><button onClick={() => window.print()}>Print / Save PDF</button></div>{(() => {
          const ys = [...new Set([yearA, yearB])],
            series = ys.map(y => MONTHS.map((_, m) => spendingPeriod(books[y], settings, scope, m, m, now))),
            peak = Math.max(1, ...series.flat().map(p => Math.abs(p.total)));
          return <><p className="snapshot-help">Full-year context. Bars show magnitude; signed amounts include refunds. Current and future months are marked; reconciliation does not guarantee every expense has been entered.</p>{MONTHS.map((name, m) => <div className="snapshot-trend-row" key={name}><strong>{name.slice(0, 3)}</strong><div>{series.map((months, i) => {
                  const p = months[m];
                  return <div key={ys[i]} className="snapshot-bar-line"><span>{ys[i]}</span><div className="snapshot-bar-track" aria-hidden="true"><i style={{
                        width: Math.abs(p.total) / peak * 100 + '%',
                        background: i ? '#176b80' : '#697a8c'
                      }} /></div><strong>{money(p.total)}{p.missing ? ' *' : ''}</strong><small>{p.current ? 'Partial' : p.future ? 'Future' : p.reviewed ? 'Reviewed' : 'Unreviewed'}</small></div>;
                })}</div></div>)}</>;
        })()}</section>
 </>}</section>;
}
