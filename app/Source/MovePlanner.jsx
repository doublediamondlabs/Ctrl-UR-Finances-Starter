import React, { useEffect, useState } from 'react';
import { readBook } from './workbook.js';
import { MONTHS, KNOWN_ONE_OFFS, defaultPlan, baseline, suggestedRule, categoryCosts, calculate, number, money } from './movePlanner.js';
const cash = v => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(v);
const showMonth = s => s ? new Date(s + '-15T12:00:00').toLocaleDateString('en-US', {
  month: 'short',
  year: 'numeric'
}) : 'Not set';
function Field({
  label,
  value,
  onChange,
  type = 'number',
  hint,
  ...props
}) {
  if (type === 'month') {
    const raw = String(value || ''),
      parts = raw.split('-'),
      year = /^\d{4}$/.test(parts[0]) ? parts[0] : '',
      month = /^(0[1-9]|1[0-2])$/.test(parts[1] || '') ? parts[1] : '';
    const years = [...new Set([...Array.from({
      length: 101
    }, (_, i) => String(2000 + i)), ...(year ? [year] : [])])].sort();
    return <fieldset className="planner-month"><legend>{label}</legend><div className="planner-month-controls"><select aria-label={label + ' month'} value={month} onChange={e => onChange(year + '-' + e.target.value)}><option value="">Choose month</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}</select><select aria-label={label + ' year'} value={year} onChange={e => onChange(e.target.value + '-' + month)}><option value="">Choose year</option>{years.map(y => <option key={y}>{y}</option>)}</select><button type="button" disabled={!raw} onClick={() => onChange('')}>Clear</button></div>{raw && (!year || !month) && <small role="status">Choose both a month and a year.</small>}{hint && <small>{hint}</small>}</fieldset>;
  }
  return <label>{label}<input type={type} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? '0' : undefined} value={value ?? ''} onChange={e => onChange(e.target.value)} {...props} />{hint && <small>{hint}</small>}</label>;
}
function PaymentPicker({
  choices,
  loading,
  error,
  year,
  onRetry,
  onApply
}) {
  const [selected, setSelected] = useState('');
  const row = choices.find(r => r.id === selected);
  return <div><label>Use A Recorded Business Expense<select value={row ? selected : ''} disabled={loading} onChange={e => setSelected(e.target.value)}><option value="">{loading ? 'Loading Recorded Payments…' : 'Choose An Existing Payment'}</option>{choices.map(r => <option key={r.id} value={r.id}>{r.month} · {r.description} · {cash(r.amount)}</option>)}</select></label><small>{loading ? 'Loading business expenses for ' + year + '…' : error ? 'Could not load recorded payments: ' + error : choices.length ? 'Select a payment, then use the button to copy its amount. Loading or browsing this list does not change your monthly payment.' : 'No recorded business expenses found for ' + year + '. You can enter a payment manually.'}</small>{row && <p className="hint">Selected: {row.month} · {row.description} · <strong>{cash(row.amount)}</strong></p>}<div className="move-payment-actions"><button type="button" disabled={!row || loading} onClick={() => {
        onApply(row);
        setSelected('');
      }}>Use Selected Payment</button><button type="button" disabled={loading} onClick={onRetry}>Reload Payments</button></div></div>;
}
export default function MovePlanner({
  api,
  links,
  onDirty,
  onEnabled
}) {
  const [data, setData] = useState(null),
    [saved, setSaved] = useState(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [section, setSection] = useState('baseline'),
    [view, setView] = useState('both'),
    [message, setMessage] = useState(''),
    [sourceBook, setSourceBook] = useState(null),
    [activeCategory, setActiveCategory] = useState(null),
    [activeCost, setActiveCost] = useState(null),
    [activeLoan, setActiveLoan] = useState(null),
    [paymentsLoading, setPaymentsLoading] = useState(false),
    [paymentsError, setPaymentsError] = useState(''),
    [paymentsReload, setPaymentsReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    api('move-planner').then(r => {
      if (!alive) return;
      const p = defaultPlan();
      setSaved(r.planner);
      setData(r.planner || {
        version: 1,
        enabled: true,
        active: p.id,
        plans: [p],
        year: Number(Object.keys(links).sort().at(-1)) || new Date().getFullYear(),
        months: [],
        excluded: {
          ...KNOWN_ONE_OFFS
        },
        rules: {},
        snapshot: null
      });
    }).catch(e => setError(e.message)).finally(() => {
      if (alive) setBusy(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!data || section !== 'assumptions' || activeCost !== 'business') return;
    let alive = true;
    setPaymentsLoading(true);
    setPaymentsError('');
    setSourceBook(null);
    api('workbook?year=' + data.year).then(response => {
      const book = readBook(response.base64, Number(data.year));
      if (alive) setSourceBook(book);
    }).catch(e => {
      if (alive) setPaymentsError(e.message);
    }).finally(() => {
      if (alive) setPaymentsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [data?.year, section, activeCost, paymentsReload]);
  useEffect(() => {
    onDirty(dirty || busy);
    return () => onDirty(false);
  }, [dirty, busy]);
  function update(next) {
    setData(d => ({
      ...d,
      ...next
    }));
    setDirty(true);
    setMessage('');
  }
  function planUpdate(next) {
    update({
      plans: data.plans.map(p => p.id === data.active ? {
        ...p,
        ...next
      } : p)
    });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await api('move-planner', {
        planner: data,
        previous: saved
      });
      setSaved(r.planner);
      setDirty(false);
      onEnabled(r.planner.enabled);
      setMessage('Planner saved. Actual workbook entries were not changed.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const response = await api('workbook?year=' + data.year);
      const book = readBook(response.base64, Number(data.year));
      setSourceBook(book);
      const snap = baseline(book, data.months, data.excluded);
      const rules = {
        ...data.rules
      };
      for (const row of snap.rows) {
        const old = data.snapshot?.year === snap.year && JSON.stringify(data.snapshot.months) === JSON.stringify(snap.months) ? data.snapshot.rows.find(r => r.id === row.id) : null;
        const current = rules[row.id] || suggestedRule(row);
        rules[row.id] = {
          ...current,
          reviewed: old && JSON.stringify(old.entries) === JSON.stringify(row.entries) ? current.reviewed : false
        };
      }
      update({
        snapshot: snap,
        rules
      });
      setMessage('History refreshed. Review new or changed categories, then Save Planner. Estimates were retained.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function ruleUpdate(id, next) {
    update({
      rules: {
        ...data.rules,
        [id]: {
          ...(data.rules[id] || suggestedRule(data.snapshot.rows.find(r => r.id === id))),
          ...next
        }
      }
    });
  }
  function exclusion(row, entry, checked) {
    const excluded = {
      ...data.excluded
    };
    if (checked) excluded[entry.id] = 'Excluded from future budget';else delete excluded[entry.id];
    const snap = structuredClone(data.snapshot);
    const g = snap.rows.find(r => r.id === row.id);
    g.futureTotal = money(g.entries.reduce((s, e) => s + (excluded[e.id] ? 0 : e.amount || 0), 0));
    g.average = money(g.futureTotal / snap.months.length);
    g.missing = g.entries.filter(e => !excluded[e.id] && e.amount === null).length;
    update({
      excluded,
      snapshot: snap,
      rules: {
        ...data.rules,
        [row.id]: {
          ...(data.rules[row.id] || suggestedRule(row)),
          reviewed: false
        }
      }
    });
  }
  if (!data) return <section className="panel">{error || 'Loading planner…'}</section>;
  const p = data.plans.find(x => x.id === data.active),
    costs = categoryCosts(data.snapshot, data.rules),
    sold = calculate(p, data.snapshot, data.rules, 'sold'),
    both = calculate(p, data.snapshot, data.rules, 'both'),
    calc = view === 'sold' ? sold : both;
  const change = (k, v) => planUpdate({
    [k]: v
  });
  const field = (key, label, hint, type = 'number') => <Field key={key} label={label} value={p[key]} onChange={v => change(key, v)} hint={hint} type={type} />;
  const obligation = (id, next) => planUpdate({
    obligations: p.obligations.map(o => o.id === id ? {
      ...o,
      ...next
    } : o)
  });
  function card(result, title) {
    const incomplete = result.issues.length > 0;
    const label = incomplete ? 'Incomplete Scenario' : result.firstNegative ? 'Available Household Cash Runs Out' : result.sustainable < 0 ? 'Ongoing Monthly Shortfall' : result.firstReserve ? 'Below Chosen Reserve' : result.cushion === null ? 'Cushion Not Chosen' : p.householdReserve === '' || p.businessReserve === '' ? 'Reserve Targets Not Chosen' : result.sustainable < result.cushion ? 'Below Desired Cushion' : 'Within Entered Targets';
    const color = incomplete ? 'neutral' : result.firstNegative || result.sustainable < 0 ? 'red' : result.firstReserve || result.cushion === null || p.householdReserve === '' || p.businessReserve === '' || result.sustainable < result.cushion ? 'amber' : 'green';
    const last = result.rows.at(-1);
    return <article className="overview-card"><h3>{title}</h3><span className={'status-cue cue-' + color}>{label}</span>{!incomplete && last && <p className="hint">Cash balances at the end of <strong>{showMonth(last.month)}</strong> · {p.horizon} months from the move. Includes cash held back as reserves.</p>}<dl><div><dt>Ongoing monthly remainder*</dt><dd>{incomplete ? '—' : cash(result.sustainable)}</dd></div><div><dt>Household cash remaining</dt><dd>{incomplete ? '—' : cash(last?.household || 0)}</dd></div><div><dt>Business cash remaining</dt><dd>{incomplete ? '—' : cash(last?.business || 0)}</dd></div></dl>{!incomplete && <small>{result.firstNegative ? 'Cash runs out: ' + showMonthSafe(result.firstNegative) : result.firstReserve ? 'Reserve crossed: ' + showMonthSafe(result.firstReserve) : 'No reserve breach within the modeled period.'}</small>}</article>;
  }
  const selectedMismatch = data.snapshot && (data.snapshot.year !== Number(data.year) || JSON.stringify(data.months) !== JSON.stringify(data.snapshot.months));
  const businessChoices = (sourceBook?.records || []).filter(r => r.scope === 'business' && r.kind === 'expense' && r.state === 'recorded' && r.amount !== null);
  return <div className="move-planner"><section className="panel move-toolbar"><div><h2>Move & Housing Planner</h2><p>Explore the transition and the monthly budget afterward. Saved plans are separate from actual expenses.</p></div><div><button className="primary" disabled={busy || !dirty && !!saved} onClick={save}>{busy ? 'Working…' : dirty ? 'Save Planner · Unsaved Changes' : 'Save Planner'}</button><button disabled={busy || !dirty} onClick={() => {
          if (confirm('Discard unsaved planner changes?')) {
            if (saved) setData(structuredClone(saved));else {
              const n = defaultPlan();
              setData({
                version: 1,
                enabled: true,
                active: n.id,
                plans: [n],
                year: Number(Object.keys(links).sort().at(-1)) || new Date().getFullYear(),
                months: [],
                excluded: {
                  ...KNOWN_ONE_OFFS
                },
                rules: {},
                snapshot: null
              });
            }
            setDirty(false);
            setError('');
          }
        }}>Discard Changes</button></div></section>
 {error && <p role="alert" className="error">{error}</p>}{data.snapshot && <p className="hint">Planning snapshot: {data.snapshot.year} · {data.snapshot.months.length} selected months · Last refreshed {new Date(data.snapshot.refreshed).toLocaleString()}. Later workbook edits enter this plan only when you refresh.</p>}{message && <p className="notice" role="status">{message}</p>}
 <fieldset disabled={busy} className="move-fieldset"><div className="move-toolbar"><label>Saved Scenario<select value={data.active} onChange={e => update({
            active: e.target.value
          })}>{data.plans.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label><button disabled={data.plans.length >= 12} onClick={() => {
          const q = {
            ...structuredClone(p),
            id: crypto.randomUUID(),
            name: p.name + ' Copy'
          };
          update({
            plans: [...data.plans, q],
            active: q.id
          });
        }}>Duplicate Scenario</button><button disabled={data.plans.length === 1} onClick={() => {
          if (confirm('Delete this planning scenario? Actual entries are unaffected.')) {
            const plans = data.plans.filter(q => q.id !== p.id);
            update({
              plans,
              active: plans[0].id
            });
          }
        }}>Delete Scenario</button><label className="move-check"><input type="checkbox" checked={data.enabled} onChange={e => update({
            enabled: e.target.checked
          })} />Show In Left Navigation</label></div><p className="hint">Hide it here and save when finished. Reopen through Tools & Settings → Move Planner Settings. Baseline choices are shared by your saved scenarios.</p>
 <div className="year-tabs" role="tablist" aria-label="Planner sections">{[['baseline', '1 · Review Baseline'], ['assumptions', '2 · Costs & Cash'], ['results', '3 · Compare & Timeline']].map(([key, label]) => <button key={key} role="tab" aria-selected={section === key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}>{label}</button>)}</div>
 {section === 'baseline' && <section className="panel"><h3>Reviewed Residence History</h3><details className="move-baseline-help"><summary>How to use these estimates</summary><p>Start with your average monthly spending, then decide what continues at the new home. A blank override keeps the category average after individual exclusions. Current home-only costs end at sale; replacement categories use the New home estimate and can retain a current home overlap cost. Record why you changed an estimate in Reason / Source. Moving, closing and initial household setup belong in Costs &amp; Cash → Moving &amp; Purchase Cash Costs.</p></details><div className="move-toolbar"><label>Workbook Year<select value={data.year} onChange={e => update({
              year: Number(e.target.value)
            })}>{[...new Set([Number(data.year), ...Object.keys(links).map(Number)])].sort().map(y => <option key={y}>{y}</option>)}</select></label><button className="primary" onClick={refresh}>Refresh From Expense Book</button></div><div className="move-months">{MONTHS.map(m => <label className="move-check" key={m}><input type="checkbox" checked={data.months.includes(m)} onChange={e => update({
              months: MONTHS.filter(x => x === m ? e.target.checked : data.months.includes(x))
            })} />{m.slice(0, 3)}</label>)}</div><p className="hint">Select only months you have reviewed. All selected months count in the average, including months with no purchases. Planned entries, transfers, refunds recorded as income, and family loan receipts are not treated as Residence expenses.</p>
 {selectedMismatch && <p className="notice">Selection changed. Refresh to use it; the current snapshot still uses the months below.</p>}
 {data.snapshot && <><p><strong>{data.snapshot.months.join(', ')} {data.snapshot.year}</strong> · Refreshed {new Date(data.snapshot.refreshed).toLocaleString()}</p><div className="move-summary"><span>Historical monthly expenses <strong>{cash(data.snapshot.total / data.snapshot.months.length)}</strong></span><span>After individual exclusions <strong>{cash(costs.current)}</strong></span><span>Categories awaiting review <strong>{data.snapshot.rows.filter(r => !data.rules[r.id]?.reviewed).length}</strong></span></div><p className="notice">The confirmed ENT payoff and truck sales-tax entries are excluded from future planning only. Review category treatment below. Mortgage and home insurance are initially Current home-only. Utilities can be replaced by New home estimates while retaining a current home overlap amount.</p>
 <p className="hint">Choose a category to review it below. Choose it again to close it. Each tab always shows its historical average after exclusions and its review status.</p><div className="year-tabs move-category-tabs" aria-label="Residence planning categories">{data.snapshot.rows.map(row => {
              const r = data.rules[row.id] || suggestedRule(row),
                selected = activeCategory === row.id;
              return <button type="button" key={row.id} className={'move-category-tab' + (selected ? ' active' : '')} aria-expanded={selected} aria-controls="move-category-editor" onClick={() => setActiveCategory(selected ? null : row.id)}><strong>{row.name}</strong><span className="move-category-tab-status"><span>{cash(row.average)}/month</span><span className={'move-review-state ' + (r.reviewed ? 'reviewed' : 'needs-review')}>{r.reviewed ? '✓ Reviewed' : 'Needs Review'}</span></span></button>;
            })}</div>
 {data.snapshot.rows.filter(row => row.id === activeCategory).map(row => {
            const r = data.rules[row.id] || suggestedRule(row);
            return <section className="move-category move-category-editor" id="move-category-editor" key={row.id} aria-label={row.name + ' planning details'}><div className="move-category-editor-heading"><h3>{row.name}</h3><span>{cash(row.average)}/month · {r.reviewed ? 'Reviewed' : 'Needs Review'}</span><button type="button" onClick={() => setActiveCategory(null)}>Close Category</button></div><div className="form-grid"><label>Future Treatment<select value={r.mode} onChange={e => ruleUpdate(row.id, {
                    mode: e.target.value,
                    reviewed: false
                  })}><option value="continue">Continues In New home</option><option value="illinois">Current home Only · Ends At Sale</option><option value="replace">Replace With New home Estimate</option><option value="exclude">Exclude From Future Budget</option></select></label><Field label="Monthly Planning Override" value={r.monthly} onChange={v => ruleUpdate(row.id, {
                  monthly: v,
                  reviewed: false
                })} hint={'Blank uses historical average ' + cash(row.average)} />{r.mode === 'replace' && <Field label="New home Monthly Estimate" value={r.texas} onChange={v => ruleUpdate(row.id, {
                  texas: v,
                  reviewed: false
                })} />} {['replace', 'illinois'].includes(r.mode) && <Field label="Current home Monthly Cost During Overlap" value={r.overlap} onChange={v => ruleUpdate(row.id, {
                  overlap: v,
                  reviewed: false
                })} hint="Blank uses planning override or historical average." />}<Field label="Reason / Source" type="text" value={r.note} onChange={v => ruleUpdate(row.id, {
                  note: v
                })} /></div><label className="move-check"><input type="checkbox" checked={r.reviewed} onChange={e => ruleUpdate(row.id, {
                  reviewed: e.target.checked
                })} />I Reviewed This Category’s Future Treatment</label><details><summary>Original Entries · Exclude Individual One-Time Costs</summary><div className="table-scroll"><table><thead><tr><th>Exclude From Future</th><th>Month</th><th>Description</th><th>Amount</th></tr></thead><tbody>{row.entries.map(e => <tr key={e.id}><td><input type="checkbox" aria-label={'Exclude ' + e.description + ' ' + e.month} checked={!!data.excluded[e.id]} onChange={ev => exclusion(row, e, ev.target.checked)} />{data.excluded[e.id] && <small>{data.excluded[e.id]}</small>}</td><td>{e.month}</td><td>{e.description}</td><td>{e.amount === null ? 'Missing' : cash(e.amount)}</td></tr>)}</tbody></table></div></details></section>;
          })}</>}
 </section>}
 {section === 'assumptions' && <><div className="year-tabs move-cost-tabs" aria-label="Costs and cash sections">{[['income', 'Income & Timing'], ['cash', 'Cash Available Today'], ['housing', 'New home Housing'], ['business', 'Business & Loans']].map(([key, label]) => <button type="button" key={key} className={activeCost === key ? 'active' : ''} aria-expanded={activeCost === key} aria-controls={'move-cost-' + key} onClick={() => setActiveCost(activeCost === key ? null : key)}>{label}</button>)}</div>{!activeCost && <p className="hint">Choose a tab to review its assumptions. Choose the same tab again to close it.</p>}<section className="panel move-cost-section" id="move-cost-income" hidden={activeCost !== 'income'} aria-label="Income & Timing"><div className="move-category-editor-heading"><h3>Income & Timing</h3><button type="button" onClick={() => setActiveCost(null)} title="Collapse these fields. Stay on Costs & Cash; your edits are retained.">Collapse Tab</button></div><div className="form-grid">{field('name', 'Scenario Name', null, 'text')}{field('income', 'Reliable Monthly Household Income', 'Retirement/disability baseline. Excludes business sales, transfers, tax refunds and loan receipts.')}{field('start', 'Move Month', null, 'month')}{field('overlap', 'Months Carrying Both Homes', 'Sale occurs after these full overlap months.')}{field('horizon', 'Projection Months', '1–120 months from the move.')}{field('cushion', 'Desired Monthly Cushion', 'Optional. Blank shows the remainder without judging comfort.')}</div><label className="move-check"><input type="checkbox" checked={p.incomeConfirmed} onChange={e => change('incomeConfirmed', e.target.checked)} />I Confirmed The Reliable Income Amount</label></section>
 <section className="panel move-cost-section" id="move-cost-cash" hidden={activeCost !== 'cash'} aria-label="Cash Available Today"><div className="move-category-editor-heading"><h3>Cash Available Today</h3><button type="button" onClick={() => setActiveCost(null)} title="Collapse these fields. Stay on Costs & Cash; your edits are retained.">Collapse Tab</button></div><div className="form-grid">{field('cashDate', 'Balances As Of', null, 'date')}{field('checking', 'Personal Checking')}{field('savings', 'Personal Savings')}{field('businessCash', 'Business Cash')}{field('householdReserve', 'Household Cash To Hold Back', 'Optional floor for comparison. Blank means no reserve target chosen.')}{field('businessReserve', 'Business Cash To Hold Back', 'This amount will not be used for listed loan payments. Blank permits use of the whole business balance.')}{field('saleProceeds', 'Net Current home Sale Proceeds', 'After mortgage payoff and selling costs. Enter 0 to test without relying on sale proceeds.')}{field('upfront', 'Moving & Purchase Cash Costs', 'Total from household cash: moving, closing, down payment, repairs/setup. Exclude loan payoff cash entered below.')}</div><p className="notice">Balances are the starting cash assumption for the move. Pre-move income and spending are not automatically projected. Adjust balances or include expected pre-move cash uses in the amount above. Do not count sale proceeds before they are available. Entered net sale proceeds arrive at the start for Current home Sold, or in the first month after the overlap for Both Homes.</p></section>
 <section className="panel move-cost-section" id="move-cost-housing" hidden={activeCost !== 'housing'} aria-label="New home Housing · Monthly Amounts"><div className="move-category-editor-heading"><h3>New home Housing · Monthly Amounts</h3><button type="button" onClick={() => setActiveCost(null)} title="Collapse these fields. Stay on Costs & Cash; your edits are retained.">Collapse Tab</button></div><p className="hint">Enter principal & interest separately from insurance and tax; do not enter an escrow-inclusive mortgage total and count those costs twice. Enter 0 for a known zero. Blank means not estimated.</p><div className="form-grid">{field('mortgage', 'Mortgage Principal & Interest')}{field('insurance', 'Homeowners Insurance')}{field('tax', 'Property Tax', 'Annual estimate divided by 12; use property-specific exemptions.')}{field('hoa', 'HOA / Association Dues')}{field('maintenance', 'Home Maintenance Allowance')}{field('irregular', 'Other Irregular Monthly Allowance', 'Only costs not already covered by the category averages, such as future registrations or repairs.')}{field('illinoisTax', 'Current home Monthly Tax During Overlap', 'Current bill is $0. Confirm whether moving changes eligibility; enter the planning estimate.')}</div><details><summary>Estimate Sources & Property-Tax Guidance</summary><p>New home: a 70–100% disabled-veteran rating generally allows up to $12,000 off assessed value under Section 11.22, not off the tax bill. A full qualifying homestead exemption under Section 11.131 has different eligibility requirements. Rates and other exemptions vary by property. Do not assume the Current home exemption continues after the home stops being your primary residence.</p><p className="hint">Check local property tax rules and exemptions for both homes. The app does not determine eligibility or calculate property taxes.</p><label>Quotes / Assumptions / Dates<textarea value={p.notes} onChange={e => change('notes', e.target.value)} rows="4" placeholder="Insurance quote from… as of…; tax estimate from…; moving allowance includes…" /></label></details></section>
 <section className="panel move-cost-section" id="move-cost-business" hidden={activeCost !== 'business'} aria-label="Business Obligations & Optional Restart"><div className="move-category-editor-heading"><h3>Business Obligations & Optional Restart</h3><button type="button" onClick={() => setActiveCost(null)} title="Collapse these fields. Stay on Costs & Cash; your edits are retained.">Collapse Tab</button></div><p className="hint">List payments that must continue if the business stops. Business cash above its holdback pays these first; the household covers the remainder. Keep these out of Residence planning categories to avoid counting them twice.</p><button type="button" onClick={() => {
            const id = crypto.randomUUID();
            planUpdate({
              obligations: [...p.obligations, {
                id,
                name: 'Other Obligation',
                monthly: '',
                payoff: '',
                payoffCash: '',
                confirmed: false,
                source: ''
              }]
            });
            setActiveLoan(id);
          }}>Add Loan / Obligation</button><div className="year-tabs move-loan-tabs" aria-label="Loans and obligations">{p.obligations.map(o => <button type="button" key={o.id} className={activeLoan === o.id ? 'active' : ''} aria-expanded={activeLoan === o.id} aria-controls="move-loan-editor" onClick={() => setActiveLoan(activeLoan === o.id ? null : o.id)}><strong>{o.name || 'Obligation'}</strong><small>{o.monthly === '' ? 'Amount Needed' : cash(Number(o.monthly)) + '/month'}</small></button>)}</div>{p.obligations.filter(o => o.id === activeLoan).map(o => <section className="move-category" id="move-loan-editor" key={o.id} aria-label={(o.name || 'Obligation') + ' payment details'}><div className="form-grid"><Field label="Name" type="text" value={o.name} onChange={v => obligation(o.id, {
                name: v
              })} /><Field label="Monthly Required Payment" value={o.monthly} onChange={v => obligation(o.id, {
                monthly: v
              })} /><PaymentPicker choices={businessChoices} loading={paymentsLoading} error={paymentsError} year={data.year} onRetry={() => setPaymentsReload(n => n + 1)} onApply={r => obligation(o.id, {
                monthly: String(r.amount),
                source: `${sourceBook.year} ${r.month} · ${r.description} · ${r.id}`
              })} /><Field label="Final Payment / Payoff Month (Optional)" type="month" value={o.payoff} onChange={v => obligation(o.id, {
                payoff: v,
                confirmed: false
              })} /><Field label="Additional Payoff Cash" value={o.payoffCash} onChange={v => obligation(o.id, {
                payoffCash: v
              })} hint="In addition to the normal payment that month. Paid from household cash; enter 0 if none." /></div>{o.source && <small>{o.source}</small>}{o.payoff && <label className="move-check"><input type="checkbox" checked={o.confirmed} onChange={e => obligation(o.id, {
                confirmed: e.target.checked
              })} />{o.confirmed ? 'Payoff Confirmed' : 'Payoff Assumed · Not Yet Confirmed'}</label>}<button onClick={() => {
              planUpdate({
                obligations: p.obligations.filter(x => x.id !== o.id)
              });
              setActiveLoan(null);
            }}>Remove From Plan</button></section>)}<div className="form-grid">{field('businessIncome', 'Optional Business Cash Per Month After Restart', 'Default 0: no restart assumed. Cash after other business costs/taxes, but BEFORE loan payments listed above. Retained in the business pool.')}{field('restart', 'Assumed Business Restart Month', null, 'month')}</div><p className="hint">The ongoing household affordability figure always excludes business income. The cash timeline can include the optional restart assumption.</p></section></>}
 {section === 'results' && <><div className="overview-grid"><article className="overview-card"><h3>Current Current home Baseline</h3><dl><div><dt>Recorded monthly expenses</dt><dd>{data.snapshot ? cash(data.snapshot.total / data.snapshot.months.length) : '—'}</dd></div><div><dt>After one-time exclusions</dt><dd>{data.snapshot ? cash(costs.current) : '—'}</dd></div><div><dt>Reliable monthly income</dt><dd>{number(p.income) === null ? '—' : cash(Number(p.income))}</dd></div></dl><small>Historical reference. Excludes business obligations and planning adjustments.</small></article>{card(sold, 'New home · Current home Sold')}{card(both, 'New home · Both Homes')}</div><p className="hint">*Ongoing remainder uses the first post-sale month ({showMonth(calc.postSaleMonth)} for the selected view), excludes business income/cash support, and respects entered payoff assumptions. Cash results cover {p.horizon || '—'} months. These scenarios use the same starting cash; entered net sale proceeds arrive when the Current home sale occurs.</p>
 <div className="year-tabs"><button className={view === 'sold' ? 'active' : ''} onClick={() => setView('sold')}>Current home Sold Before Move</button><button className={view === 'both' ? 'active' : ''} onClick={() => setView('both')}>Carry Both Homes</button></div>
 {calc.issues.length > 0 ? <section className="panel"><h3>Incomplete Scenario · {calc.issues.length} Items</h3><p>Totals stay hidden until missing amounts and category decisions are resolved.</p><ul>{calc.issues.map(x => <li key={x}>{x}</li>)}</ul><button onClick={() => setSection(calc.costs.issues.length ? 'baseline' : 'assumptions')}>Continue Setup</button></section> : <><section className="panel"><h3>Monthly Housing Room</h3><strong className={calc.room < 0 ? 'amount-negative' : 'amount-positive'}>{cash(calc.room)}</strong><p>Available for New home mortgage principal & interest after the other entered costs{calc.cushion === null ? ', with no cushion target chosen' : ', including your ' + cash(calc.cushion) + ' cushion'}. {calc.room < 0 ? 'A negative amount means those costs already exceed reliable income.' : 'This is a planning limit, not a lender approval.'}</p><p className="hint">{p.householdReserve === '' ? 'No household reserve floor chosen. ' : ''}{p.businessReserve === '' ? 'No business holdback chosen. ' : ''}{p.obligations.some(o => o.payoff && !o.confirmed) ? 'Includes unconfirmed payoff assumptions. ' : ''}{calc.businessAssumed ? 'Timeline includes assumed business restart cash.' : ''}</p></section><section className="panel"><h3>Cash Through The Move</h3><p>Household cash after upfront costs, applicable pre-move payoff cash, and any pre-move sale proceeds: <strong>{cash(calc.initialHousehold)}</strong> · Business cash: <strong>{cash(calc.initialBusiness)}</strong></p><div className="table-scroll"><table><thead><tr><th>Month</th><th>Total Monthly Expenses</th><th>Current home Carrying Cost</th><th>Business Pays Toward Loans</th><th>Extra Payoff Cash</th><th>Net Sale Proceeds</th><th>Household Cash Change</th><th>Household Cash Left</th><th>Business Cash Left</th></tr></thead><tbody>{calc.rows.map(r => <tr key={r.month}><td>{showMonth(r.month)}</td><td>{cash(r.expenses)}</td><td>{cash(r.illinois)}</td><td>{cash(r.businessDraw)}</td><td>{cash(r.payoff)}</td><td>{cash(r.saleCash)}</td><td className={r.cashflow < 0 ? 'amount-negative' : 'amount-positive'}>{cash(r.cashflow)}</td><td className={r.household < 0 ? 'amount-negative' : ''}>{cash(r.household)}</td><td>{cash(r.business)}</td></tr>)}</tbody></table></div><p className="hint">Negative cash shows the unfunded amount if the scenario continues. Household reserves are a warning threshold; business holdback is protected from loan draws. No savings interest, inflation, automatic tax estimate or unentered sale proceeds are assumed.</p></section></>}
 </>}
 </fieldset></div>;
}
function showMonthSafe(s) {
  return /^\d{4}-\d{2}$/.test(s) ? showMonth(s) : s;
}
