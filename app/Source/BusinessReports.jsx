import TaxAttention from './TaxAttention.jsx';
import InspectionLocations from './InspectionLocations.jsx';
import { inspectionLocations, inspectionLocationCSV } from './dealerVisits.js';
import TaxTreatmentNotes, { taxNoteExport } from './TaxTreatmentNotes.jsx';
import TaxTimeSummary from './TaxTimeSummary.jsx';
import React, { useState, useRef, useEffect } from 'react';
import { activityData, taxData, TAX_GROUPS, downloadCSV, manufacturerGroups, taxRollups, assignTaxCategory, assignTaxEntry, taxLabel, taxCategoryLabel } from './businessReports.js';
import { MONTHS } from './inspectionIncome.js';
import { sum, completion } from './analytics.js';
import { linkedPayment } from './debts.js';
const money = n => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(n),
  date = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Date Not Reviewed';
export default function BusinessReports({
  mode,
  book,
  reporting = {},
  onSaveReporting,
  loans = [],
  debtBooks = [],
  debtErrors = [],
  onOpen,
  onOpenInspection,
  onEditEntry,
  onReviewMonth,
  onOpenMileage,
  initialState = {},
  sectionRequest,
  onSectionHandled,
  onState
}) {
  const mappingRef = useRef(null),
    groupsRef = useRef(null);
  function showGroup(label) {
    setTab('expenses');
    setTaxGroup(label);
    setTimeout(() => groupsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    }), 0);
  }
  function showAssignments() {
    setTab('expenses');
    setTimeout(() => {
      if (mappingRef.current) {
        mappingRef.current.open = true;
        mappingRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 0);
  }
  const [locationView, setLocationView] = useState(initialState.locationView || 'all');
  const [dealerVehicle, setDealerVehicle] = useState(initialState.dealerVehicle || 'All');
  const [taxNotice, setTaxNotice] = useState('');
  async function overrideEntry(row, label) {
    setBusy(true);
    setError('');
    try {
      await onSaveReporting(assignTaxEntry(reporting, book.year, row.id, label));
      const target = label || row.defaultTaxGroup;
      setTaxGroup(target);
      setCategory(row.category);
      setExpenseMonth(row.month);
      setTaxNotice(`${row.description} · ${label ? 'Entry Override' : 'Category Default'}: ${target}. Saved.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const [taxGroup, setTaxGroup] = useState('');
  const [expenseMonth, setExpenseMonth] = useState('January');
  const [manufacturer, setManufacturer] = useState(initialState.manufacturer || '');
  const [vehicle, setVehicle] = useState(initialState.vehicle || 'Truck'),
    [inspectionStatus, setInspectionStatus] = useState(initialState.inspectionStatus || 'All'),
    [category, setCategory] = useState(initialState.category || '');
  const [tab, setTab] = useState(initialState.tab || (mode === 'tax' ? 'summary' : 'mileage')),
    [start, setStart] = useState(initialState.start ?? 0),
    [end, setEnd] = useState(initialState.end ?? 11),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const stateCallback = useRef(onState);
  stateCallback.current = onState;
  useEffect(() => {
    if (mode === 'activity' && sectionRequest) {
      setTab(sectionRequest.section);
      onSectionHandled?.();
    }
  }, [sectionRequest, mode]);
  useEffect(() => {
    if (mode === 'activity') stateCallback.current?.({
      tab,
      start,
      end,
      dealerVehicle,
      locationView,
      manufacturer,
      vehicle,
      inspectionStatus,
      category
    });
  }, [mode, tab, start, end, dealerVehicle, locationView, manufacturer, vehicle, inspectionStatus, category]);
  const data = activityData(book, start, end, reporting.rvGroups || {}),
    tax = taxData(book, reporting),
    all = activityData(book),
    loanRows = loans.filter(l => l.area === 'business').flatMap(l => (l.links || []).filter(p => Number(p.date?.slice(0, 4)) === book.year).map(p => ({
      ...linkedPayment(l, p, [book, ...debtBooks.filter(b => b.year !== book.year)]),
      loanName: l.name
    }))),
    unreviewed = MONTHS.filter((m, i) => (book.year < new Date().getFullYear() || book.year === new Date().getFullYear() && i <= new Date().getMonth()) && completion(book, reporting, 'business', i) !== 'Reconciled');
  const dealerData = inspectionLocations(book, data.trips, dealerVehicle, reporting.dealerVisitReviews || {});
  async function reviewDealer(row, note) {
    setBusy(true);
    setError('');
    try {
      const next = {
        ...reporting.dealerVisitReviews
      };
      if (note === null) delete next[row.reviewKey];else next[row.reviewKey] = {
        signature: row.signature,
        note: note.trim(),
        reviewedAt: new Date().toISOString()
      };
      await onSaveReporting({
        ...reporting,
        dealerVisitReviews: next
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const manufacturers = manufacturerGroups(data.jobs),
    selectedManufacturer = manufacturers.find(g => g.key === manufacturer) || manufacturers[0];
  const rollups = taxRollups(tax.groups),
    selectedTax = rollups.find(g => g.label === taxGroup) || (taxGroup === 'Hold For Tax Review' ? {
      label: taxGroup,
      groups: [],
      rows: [],
      total: 0
    } : rollups[0]),
    allCategoryNames = [...new Set(tax.groups.map(g => g.category))];
  const selectedVehicle = data.vehicles.find(v => v.vehicle === vehicle) || data.vehicles[0],
    categoryNames = [...new Set((selectedTax?.groups || []).map(g => g.category))],
    selectedCategory = categoryNames.includes(category) ? category : categoryNames[0],
    categoryGroups = (selectedTax?.groups || []).filter(g => g.category === selectedCategory),
    categoryRows = categoryGroups.flatMap(g => g.rows);
  async function assignCategory(category, label) {
    setBusy(true);
    setError('');
    try {
      await onSaveReporting(assignTaxCategory(reporting, tax.groups, category, label, book.year));
      setTaxGroup(label);
      setCategory(category);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const expenseMonths = MONTHS.filter(m => categoryRows.some(r => r.month === m)),
    selectedExpenseMonth = expenseMonths.includes(expenseMonth) ? expenseMonth : expenseMonths[0];
  const statuses = ['All', 'Completed', 'Partially Completed', 'Not Performed / Canceled', 'Needs Review', 'Scheduled'];
  const matchesStatus = (j, s) => s === 'All' || s === 'Completed' && j.status === 'Completed' || s === 'Partially Completed' && j.status === 'Partially completed' || s === 'Not Performed / Canceled' && ['Not performed', 'Canceled'].includes(j.status) || s === 'Needs Review' && (j.needsDetailReview || j.status === 'Not reviewed') || s === 'Scheduled' && j.status === 'Scheduled';
  function openInspection(row) {
    onOpenInspection?.(row, {
      tab,
      start,
      end,
      dealerVehicle,
      locationView,
      manufacturer: selectedManufacturer?.key || manufacturer,
      vehicle,
      inspectionStatus,
      category: selectedCategory || category
    });
  }
  async function assign(field, key, value) {
    setBusy(true);
    setError('');
    try {
      const next = {
        ...reporting[field]
      };
      if (value.trim()) next[key] = value.trim();else delete next[key];
      await onSaveReporting({
        ...reporting,
        [field]: next
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function exportActivity() {
    downloadCSV(`Business-Activity-${book.year}.csv`, [['Business Activity & Mileage', book.year, MONTHS[start], MONTHS[end]], ['Recorded miles only; not a calculated tax deduction'], ['Vehicle', 'Recorded Miles', 'Rows Needing Review'], ...data.vehicles.map(v => [v.vehicle, v.miles, v.missing]), [], ['Date / Month', 'Inspection / Travel', 'Vehicle', 'Miles', 'Purpose', 'Outcome', 'Location', 'Notes', 'Review Needed'], ...data.trips.map(r => [r.inspectionDate || r.month, r.label, r.vehicle, r.miles, r.purpose, r.inspectionStatus, r.location, r.note, r.needsReview ? 'Yes' : '']), [], ['Inspection', 'Make (Report Group)', 'Model', 'Period Outcome', 'Visits In Period', 'Original Entry'], ...data.jobs.map(j => [j.label, j.makeGroup, j.model, j.status, j.visits, j.legacy ? 'Needs Review' : '']), [], ['Undated Jobs — Year Association Only'], ...data.undated.map(x => [x]), ...inspectionLocationCSV(inspectionLocations(book, data.trips, 'All', reporting.dealerVisitReviews || {}))]);
  }
  function exportTax() {
    downloadCSV(`Tax-Preparation-${book.year}.csv`, [['Tax Preparation — Recorded Amounts, Not Calculated Deductions', book.year], ['Gross Positive Receipts', tax.receipts], ['Refunds / Negative Income', tax.refunds], ['Net Recorded Receipts', tax.receipts - tax.refunds], ['Recorded Business Spending', tax.spending], ['Business Income Less Recorded Expenses — Before Tax Adjustments', Math.round((tax.receipts - tax.refunds - tax.spending) * 100) / 100], ['Missing Income Amounts', tax.missingIncome.length], ['Missing Expense Amounts', tax.missing.length], ['Totals Status', tax.missingIncome.length + tax.missing.length ? 'Incomplete — known amounts only' : 'Recorded amounts; tax adjustments not calculated'], ['Guidance Status', 'General Schedule C guidance; tax treatment not verified for this filing year'], [], ['Income Detail'], ['Month', 'Description', 'Recorded Amount', 'Date', 'Notes'], ...tax.income.map(r => [r.month, r.description, r.amount ?? '', r.transactionDate, r.notes.join('\n')]), [], ['Tax Group', 'Combined Recorded Amount'], ...rollups.map(g => [g.label, g.total]), [], ['Tax Preparation Group', 'Grouping Source', 'Category', 'Subcategory', 'Month', 'Description', 'Recorded Amount', 'Date', 'Notes'], ...tax.groups.flatMap(g => g.rows.map(r => [g.label, r.taxOverride ? 'Entry Override' : 'Category Default', g.category, g.sub, r.month, r.description, r.amount, r.transactionDate, r.notes.join('\n')])), [], ['Vehicle', 'Recorded Business Miles', 'Rows Needing Review'], ...all.vehicles.map(v => [v.vehicle, v.miles, v.missing]), [], ['Business Loan', 'Date', 'Payment', 'Principal', 'Interest', 'Escrow', 'Fees', 'Review'], ...loanRows.map(p => [p.loanName, p.date, p.amount, p.principal, p.interest, p.escrow, p.fees, p.issue || p.breakdownIssue || 'Recorded Breakdown Complete']), [], ['Household Costs — Full Amounts, No Deduction Calculated'], ['Month', 'Category', 'Description', 'Amount'], ...tax.housing.map(r => [r.month, r.category, r.description, r.amount]), [], ['Month', 'Business Review Status'], ...MONTHS.map((m, i) => [m, completion(book, reporting, 'business', i)]), [], ['Treatment Notes & Sources'], ['Scope', 'Group / Entry', 'Decision / Open Question', 'Reason / Business Use', 'Sources', 'Reviewed Date'], ...taxNoteExport(reporting, book.year), [], ['Additional Information To Gather'], ['Vehicle annual total mileage and deduction method'], ['Home office eligibility, square footage and method'], ['Equipment purchase/in-service dates and business use'], ['Receipt support, travel/meals business purpose and processor annual statement']]);
  }
  function renderTaxEntry(r) {
    return <article key={r.id}><strong>{r.description} · {Number.isFinite(r.amount) ? money(r.amount) : 'Missing Amount'}</strong><label className="tax-entry-override">Tax Group Override<select aria-label={'Tax Group Override for ' + r.description} disabled={busy} value={r.taxOverride || ''} onChange={e => overrideEntry(r, e.target.value)}><option value="">Use Category Default · {r.defaultTaxGroup}</option>{r.taxOverride && !TAX_GROUPS.includes(r.taxOverride) && <option value={r.taxOverride}>{r.taxOverride} · Previous Assignment</option>}{TAX_GROUPS.map(t => <option key={t} value={t}>{t}</option>)}</select><small>{r.taxOverride ? 'Entry Override' : 'Using Category Default'} · {r.taxGroup}</small></label><p>{r.transactionDate ? date(r.transactionDate) : r.month + ' · Day Not Recorded'}{' · ' + r.category}{r.subcategory ? ' · ' + r.subcategory : ''}</p>{r.notes.length > 0 && <details><summary>Notes</summary>{r.notes.map((note, i) => <p key={i}>{note}</p>)}</details>}{onEditEntry && <button onClick={() => onEditEntry(book.year, r.id)}>Open Entry</button>}<TaxTreatmentNotes key={'entry:' + book.year + ':' + r.id} year={book.year} type="entry" id={r.id} title={r.description} reporting={reporting} onSaveReporting={onSaveReporting} /></article>;
  }
  const tabs = mode === 'tax' ? [['summary', 'Tax Overview'], ['expenses', 'Expense Groups & Review'], ['support', 'Supporting Records']] : [['mileage', 'Mileage'], ['inspections', 'Inspections'], ['rv', 'RV Breakdown'], ['dealers', 'Inspection Locations']];
  return <section className="panel business-reports"><div className="section-title"><div><h2>{mode === 'tax' ? 'Tax Preparation' : 'Business Activity & Mileage'} · {book.year}</h2><p className="hint">{mode === 'tax' ? 'Schedule C preparation worksheet · Recorded costs are not automatically deductible.' : 'Recorded activity by visit date · Income retains its payment/refund date.'}</p></div><div className="report-actions"><button onClick={mode === 'tax' ? exportTax : exportActivity}>{mode === 'tax' ? 'Export Tax Preparation Package (CSV)' : 'Export CSV'}</button><button onClick={() => window.print()}>Print / Save PDF</button><button onClick={() => onOpen(mode === 'tax' ? 'activity' : 'tax')}>{mode === 'tax' ? 'Activity & Mileage' : 'Tax Preparation'}</button></div></div>{error && <p role="alert">{error}</p>}
 {mode !== 'tax' && <div className="report-controls"><label>From Month<select value={start} onChange={e => {
          const n = +e.target.value;
          setStart(n);
          if (n > end) setEnd(n);
        }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label><label>Through Month<select value={end} onChange={e => {
          const n = +e.target.value;
          setEnd(n);
          if (n < start) setStart(n);
        }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label></div>}

 <nav className="income-tabs" aria-label="Business report sections">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'primary' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</nav>
 {mode === 'tax' && tab === 'summary' && <><div className="business-report-cards">{[['Gross Recorded Receipts', tax.receipts, tax.missingIncome.length], ['Refunds / Negative Income', tax.refunds, tax.missingIncome.length], ['Net Recorded Receipts', tax.receipts - tax.refunds, tax.missingIncome.length], ['Recorded Business Spending', tax.spending, tax.missing.length], ['Business Income Less Recorded Expenses', Math.round((tax.receipts - tax.refunds - tax.spending) * 100) / 100, tax.missing.length + tax.missingIncome.length]].map(([label, n, missing]) => <article key={label}><small>{label}</small><strong>{money(n)}</strong>{label === 'Business Income Less Recorded Expenses' && <small>Before tax adjustments</small>}{missing > 0 && <span className="report-incomplete">Incomplete · known amounts only</span>}</article>)}</div><TaxAttention book={book} tax={tax} unreviewed={unreviewed} all={all} loanRows={loanRows} debtErrors={debtErrors} onAssign={showAssignments} onHold={() => showGroup('Hold For Tax Review')} onSupport={() => {
        setTab('support');
        setTimeout(() => {
          const el = document.getElementById('tax-loan-support');
          if (el) {
            el.open = true;
            el.scrollIntoView?.({
              block: 'start',
              behavior: 'smooth'
            });
          }
        }, 0);
      }} onMileage={() => onOpenMileage ? onOpenMileage() : onOpen('activity')} onEditEntry={onEditEntry} onReviewMonth={onReviewMonth} /><TaxTimeSummary year={book.year} groups={rollups} reporting={reporting} onSaveReporting={onSaveReporting} onSelect={showGroup} onAssign={showAssignments} /><div className="report-actions"><button onClick={() => setTab('support')}>Supporting Records &amp; Missing Information</button></div></>}
 {mode === 'activity' && <p className="report-period-cue">Business · {book.year} · {MONTHS[start]}–{MONTHS[end]}</p>}
 {mode === 'activity' && tab === 'mileage' && <><div className="business-report-cards">{data.vehicles.map(v => <article key={v.vehicle}><small>{v.vehicle}</small><strong>{v.miles.toLocaleString()} mi</strong><span>{v.rows.length} recorded visit / original rows{v.missing > 0 ? ` · ${v.missing} to review` : ''}</span></article>)}</div><div className="entry-guidance"><strong>About These Miles</strong><p>Recorded Business Miles include return visits and unsuccessful inspection trips. Blank mileage is excluded from totals and flagged; original workbook mileage remains visible as unreviewed.</p></div>{data.undated.length > 0 && <details><summary>{data.undated.length} Jobs With Undated Visits · Cannot Reliably Allocate To A Month</summary>{data.undated.map((s, i) => <p key={i}>{s}</p>)}</details>}<div className="table-wrap"><table><thead><tr><th>Month</th>{data.vehicles.map(v => <th key={v.vehicle}>{v.vehicle}</th>)}</tr></thead><tbody>{MONTHS.slice(start, end + 1).map(m => <tr key={m}><th>{m}</th>{data.vehicles.map(v => <td key={v.vehicle}>{v.rows.filter(r => r.month === m).reduce((n, r) => n + (r.miles || 0), 0).toLocaleString()} mi</td>)}</tr>)}</tbody></table></div><nav className="manufacturer-tabs" aria-label="Mileage vehicles">{data.vehicles.map(v => <button key={v.vehicle} aria-pressed={vehicle === v.vehicle} className={vehicle === v.vehicle ? 'primary' : ''} onClick={() => setVehicle(v.vehicle)}>{v.vehicle} · {v.miles.toLocaleString()} mi</button>)}</nav><section className="report-detail"><h3>{selectedVehicle.vehicle} · Trips By Month</h3>{MONTHS.slice(start, end + 1).filter(m => selectedVehicle.rows.some(r => r.month === m)).map(m => {
          const rows = selectedVehicle.rows.filter(r => r.month === m);
          return <details key={m} className="report-detail" open><summary>{m} {book.year} · {rows.reduce((n, r) => n + (r.miles || 0), 0).toLocaleString()} mi</summary>{rows.map((r, i) => <article key={r.visitId || r.id + ':' + i}><strong>{date(r.inspectionDate)} · {r.label}</strong><p>{r.miles ?? 'Unknown'} mi · {r.purpose} · {r.inspectionStatus}{r.needsReview ? ' · Needs Review' : ''}</p><small>{r.location}</small>{r.note && <details><summary>Notes</summary><p>{r.note}</p></details>}<button disabled={!onOpenInspection} onClick={() => openInspection({
                ...r,
                activityDate: r.inspectionDate
              })}>Open Record</button></article>)}</details>;
        })}{!selectedVehicle.rows.length && <p>No recorded trips in this range.</p>}</section></>}

 {mode === 'activity' && tab === 'dealers' && <InspectionLocations view={locationView} onView={setLocationView} busy={busy} onReview={onSaveReporting ? reviewDealer : null} data={dealerData} vehicle={dealerVehicle} onVehicle={setDealerVehicle} onOpen={onOpenInspection ? openInspection : null} start={start} end={end} year={book.year} />}
 {mode === 'activity' && tab === 'inspections' && <><div className="business-report-cards"><article><small>Distinct Inspection Jobs With Activity</small><strong>{data.jobs.length}</strong></article><article><small>Inspection Visits In Period</small><strong>{data.jobs.reduce((n, j) => n + j.visits, 0)}</strong></article><article><small>Completed In Period</small><strong>{data.jobs.filter(j => j.status === 'Completed').length}</strong></article></div><div className="entry-guidance"><strong>How Inspection Counts Work</strong><p>Each job counts once within this range. A job with visits in two months can appear in both monthly reports; monthly distinct counts should not be added for an annual total. Mileage-only travel is excluded from inspection counts. Original unconverted entries are included provisionally. Needs Review flags missing inspection details and may overlap an outcome tab.</p></div><nav className="manufacturer-tabs" aria-label="Inspection outcomes">{statuses.map(s => <button key={s} className={inspectionStatus === s ? 'primary' : ''} aria-pressed={inspectionStatus === s} onClick={() => setInspectionStatus(s)}>{s}<span className="manufacturer-count">{data.jobs.filter(j => matchesStatus(j, s)).length}</span></button>)}</nav><div className="table-wrap"><table><thead><tr><th>Inspection</th><th>Outcome In Period</th><th>Visits</th><th>RV</th><th>Record</th></tr></thead><tbody>{data.jobs.filter(j => matchesStatus(j, inspectionStatus)).map(j => <tr key={j.id}><td>{j.label}{j.legacy && <small> · Original Entry — Needs Review</small>}</td><td>{j.status}</td><td>{j.visits}</td><td>{j.makeGroup} · {j.model}</td><td><button disabled={!onOpenInspection} onClick={() => openInspection(j)}>Open Inspection</button></td></tr>)}</tbody></table></div>{!data.jobs.some(j => matchesStatus(j, inspectionStatus)) && <p>No inspections match this status in the selected range.</p>}</>}
 {mode === 'activity' && tab === 'rv' && <><div className="entry-guidance"><strong>Explore RV Makes & Models</strong><p>Choose a manufacturer to see its customers and models. Counts represent distinct inspection jobs with activity in the selected range, including incomplete jobs.</p></div><nav className="manufacturer-tabs" aria-label="RV manufacturers">{manufacturers.map(g => <button key={g.key} aria-pressed={selectedManufacturer?.key === g.key} className={selectedManufacturer?.key === g.key ? 'primary' : ''} onClick={() => setManufacturer(g.key)}>{g.label}<span className="manufacturer-count">{g.rows.length}</span></button>)}</nav>{selectedManufacturer ? <section className="manufacturer-records" aria-label={selectedManufacturer.label + ' inspections'}><h3>{selectedManufacturer.label} · {selectedManufacturer.rows.length} Inspection{selectedManufacturer.rows.length === 1 ? '' : 's'}</h3><div className="table-wrap"><table><thead><tr><th>Customer</th><th>RV Model</th><th>Activity Date</th><th>Outcome In Period</th><th>Record</th></tr></thead><tbody>{selectedManufacturer.rows.map(j => <tr key={j.id}><td><strong>{j.customer}</strong>{j.legacy && <small> · Original Entry — Needs Review</small>}</td><td>{j.model}</td><td>{j.activityDate ? date(j.activityDate) : j.month + ' · Date Not Reviewed'}</td><td>{j.status}</td><td><button onClick={() => openInspection(j)} disabled={!onOpenInspection} aria-label={'Open Inspection for ' + j.customer + ' · ' + j.model}>Open Inspection</button></td></tr>)}</tbody></table></div><div className="entry-guidance"><strong>Opening an Inspection</strong><p>Open Inspection takes you to the existing inspection details. Opening a record does not save or change it.</p></div></section> : <p>No RV details for this range.</p>}<details className="report-detail"><summary>Group Manufacturer Names For Reporting</summary><p>Use the same reporting name to combine spelling variations. Original inspection entries remain unchanged. Applies across years.</p>{[...new Set(data.jobs.map(j => j.make))].filter(s => s !== 'Unspecified').map(make => <form key={make + ':' + (reporting.rvGroups?.[make] || '')} className="report-map-row" onSubmit={e => {
          e.preventDefault();
          assign('rvGroups', make, new FormData(e.currentTarget).get('group'));
        }}><label>{make}<input name="group" maxLength={100} defaultValue={reporting.rvGroups?.[make] || make} /></label><button disabled={busy}>Save Group</button></form>)}</details></>}
 {mode === 'tax' && tab === 'expenses' && <><p className="hint">Group your existing categories for tax preparation. Tabs show combined recorded amounts—not final deductions. Original categories, entries and reconciliation remain unchanged. New assignments apply only to the selected tax year. Existing shared defaults are preserved for years without their own assignment.</p><details ref={mappingRef} className="report-detail tax-category-mapping" open={rollups.length === 1 && rollups[0]?.label === TAX_GROUPS[0] ? true : undefined}><summary>Assign Existing Categories To Tax Groups</summary><p>Choose one tax group for each existing category in {book.year}. This assigns all of its current subcategories together. Previously saved mixed assignments remain until you choose a replacement. Individual entry overrides remain in effect when you change a category default.</p>{allCategoryNames.map(c => {
          const labels = [...new Set(tax.groups.filter(g => g.category === c).map(g => taxCategoryLabel(reporting, book.year, g.category, g.sub)))],
            value = labels.length === 1 ? labels[0] : '__mixed';
          return <label className="tax-group-choice" key={c}>{c}<select disabled={busy} value={value} onChange={e => assignCategory(c, e.target.value)}>{value === '__mixed' && <option value="__mixed" disabled>Multiple Saved Groups</option>}{!TAX_GROUPS.includes(value) && value !== '__mixed' && <option value={value}>{value} · Previous Assignment</option>}{TAX_GROUPS.map(t => <option key={t}>{t}</option>)}</select></label>;
        })}</details><p role="status" className="hint">{taxNotice}</p><nav ref={groupsRef} className="manufacturer-tabs" aria-label="Tax groups">{rollups.map(g => <button key={g.label} className={selectedTax?.label === g.label ? 'primary' : ''} aria-pressed={selectedTax?.label === g.label} onClick={() => setTaxGroup(g.label)}>{g.label} · {money(g.total)}</button>)}</nav>{selectedTax && <div className="tax-rollup-heading"><h3>{selectedTax.label} · {money(selectedTax.total)} Recorded</h3><p>{new Set(selectedTax.groups.map(g => g.category)).size} categories included · {book.year}</p>{selectedTax.label === TAX_GROUPS[0] && <p>These categories need a tax-group assignment only. This is separate from bank reconciliation.</p>}{!TAX_GROUPS.includes(selectedTax.label) && <p>Previous assignment preserved. Use Assign Existing Categories above to move it to a Schedule C preparation group.</p>}</div>}{selectedTax && <TaxTreatmentNotes key={'group:' + book.year + ':' + selectedTax.label} year={book.year} type="group" id={selectedTax.label} title={selectedTax.label} reporting={reporting} onSaveReporting={onSaveReporting} />}<details className="report-detail"><summary>Tax Group Guidance · Verify For {book.year}</summary><p className="hint">General category guidance, not a verified tax-year rules package. IRS instruction page checked October 16, 2026 and labeled 2025. Confirm the instructions for {book.year}; no rates, limits or deductions are calculated here. Keep year-specific decisions and references in Treatment Notes &amp; Sources.</p><p>Names follow the general Schedule C expense structure. Verify the final form and treatment for your filing year. Meals, vehicles, equipment and home-office amounts may require limits, allocation or separate calculations. Loan principal is not an operating deduction; do not group a full loan payment as interest.</p><p>Other Expenses retains your original category descriptions. Hold For Tax Review and Personal / Exclude are organizational buckets, not deduction lines.</p><a href="https://www.irs.gov/instructions/i1040sc" target="_blank" rel="noreferrer">IRS Schedule C Instructions — Current Page</a><p><a href="https://www.irs.gov/pub/irs-prior/i1040sc--2025.pdf" target="_blank" rel="noreferrer">2025 Instructions — Archived Reference (PDF)</a></p></details>{selectedTax?.label === 'Hold For Tax Review' ? <section className="tax-hold-list report-detail"><h3>Entries Needing A Treatment Decision · {selectedTax.rows.length}</h3><p className="hint">Review the notes and choose a Tax Group Override when ready. Entries leave this list after reassignment.</p>{selectedTax.rows.slice().sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month) || a.description.localeCompare(b.description)).map(renderTaxEntry)}{!selectedTax.rows.length && <p>No entries are currently held for tax review.</p>}</section> : <><nav className="manufacturer-tabs" aria-label="Expense categories">{categoryNames.map(c => <button key={c} className={selectedCategory === c ? 'primary' : ''} aria-pressed={selectedCategory === c} onClick={() => setCategory(c)}>{c} · {money(sum((selectedTax?.groups || []).filter(g => g.category === c).flatMap(g => g.rows)))}</button>)}</nav>{selectedCategory ? <section className="report-detail"><h3>{selectedCategory} · {book.year} · {money(sum(categoryRows))}</h3><nav className="manufacturer-tabs expense-month-tabs" aria-label="Expense months">{expenseMonths.map(m => {
              const rows = categoryRows.filter(r => r.month === m);
              return <button key={m} className={selectedExpenseMonth === m ? 'primary' : ''} aria-pressed={selectedExpenseMonth === m} onClick={() => setExpenseMonth(m)}><span>{m}</span><strong>{money(sum(rows))}</strong>{rows.some(r => !Number.isFinite(r.amount)) && <small>Missing Amounts</small>}</button>;
            })}</nav>{(selectedExpenseMonth ? [selectedExpenseMonth] : []).map(m => {
            const rows = categoryRows.filter(r => r.month === m).slice().sort((a, b) => (a.transactionDate || '9999').localeCompare(b.transactionDate || '9999') || a.description.localeCompare(b.description));
            return <section className="report-detail expense-month" key={selectedCategory + ':' + m}><h4>{m} {book.year} · {money(sum(rows))}{rows.some(r => !Number.isFinite(r.amount)) ? ' · Missing Amounts' : ''}</h4>{rows.map(renderTaxEntry)}</section>;
          })}</section> : <p>No recorded business expenses.</p>}</>}</>}

 {mode === 'tax' && tab === 'support' && <><details className="report-detail"><summary>Vehicle Mileage · Recorded Business Miles</summary>{all.vehicles.map(v => <p key={v.vehicle}>{v.vehicle}: <strong>{v.miles.toLocaleString()} mi</strong> · {v.missing} rows to review</p>)}<p>Choose the appropriate vehicle deduction method with your tax software/preparer. Standard mileage generally replaces fuel, repairs, insurance and depreciation; eligible business parking/tolls are separate. No deduction calculated here.</p><a href="https://www.irs.gov/taxtopics/tc510" target="_blank" rel="noreferrer">IRS: Business Use Of Car</a></details><details id="tax-loan-support" className="report-detail"><summary>Business Loan Payment Breakdowns · {loanRows.length} Recorded Connections</summary><p>Supporting detail only—already included in linked expenses. Principal payments are not themselves operating deductions. Interest and asset treatment need separate review.</p>{debtErrors.length > 0 && <p role="alert">Some loan workbooks could not be loaded. Open Loan Trackers before relying on these figures.</p>}{loanRows.map((p, i) => <p key={i}>{p.loanName} · {date(p.date)} · Principal {p.principal == null ? 'Unknown' : money(p.principal)} · Interest {p.interest == null ? 'Unknown' : money(p.interest)} · Escrow {p.escrow == null ? 'Unknown' : money(p.escrow)} · Fees {p.fees == null ? 'Unknown' : money(p.fees)} · {p.issue || p.breakdownIssue || 'Recorded Breakdown Complete'}</p>)}{!loanRows.length && <p>No business loan expense connections for this year.</p>}</details><details className="report-detail"><summary>Household Costs · {money(sum(tax.housing))} · Full Amounts, Not Deductions</summary><p>Reference for eligible home-office costs. Personal costs are not automatically business expenses. Office eligibility, square footage, business use, and deduction method require separate review.</p>{[...new Set(tax.housing.map(r => r.category))].map(c => <p key={c}>{c} · {money(sum(tax.housing.filter(r => r.category === c)))}</p>)}<a href="https://www.irs.gov/publications/p587" target="_blank" rel="noreferrer">IRS: Business Use Of Your Home</a></details></>}
 {mode === 'tax' && tab === 'support' && <details className="report-detail"><summary>Information Still Needed</summary><h3>Entered Records To Review</h3><ul><li>{new Set(tax.groups.filter(g => g.label === TAX_GROUPS[0]).map(g => g.category)).size} expense categories without a preparation group.</li><li>{tax.missingIncome.length} recorded business income entries missing amounts.</li><li>{tax.missing.length} recorded business expenses missing amounts.</li><li>{all.trips.filter(t => t.needsReview).length} mileage rows with missing/unreviewed details; {all.undated.length} jobs with undated visits.</li><li>{unreviewed.length} months not marked reconciled: {unreviewed.join(', ') || 'None'}. Future months may not require review yet.</li><li>{loanRows.filter(p => p.issue || !p.complete).length} linked business loan payments need review.</li></ul><h3>Additional Information To Gather</h3><p>These items are not verified by this page, even when the counts above are zero.</p><ul><li>Annual total mileage, personal/commuting mileage, odometer records and method used for each vehicle.</li><li>Home-office eligibility, office/home square footage and method; business portion of phone/internet.</li><li>Equipment purchase and in-service dates, business-use share, prior depreciation records.</li><li>Receipts and business purpose for travel/meals; any required allocation.</li><li>Processor annual statement/1099-K compared with gross receipts, refunds and timing differences.</li></ul><a href="https://www.irs.gov/publications/p334" target="_blank" rel="noreferrer">IRS: Tax Guide For Small Business</a><p className="hint">This worksheet organizes supporting records; it is not a completed tax return or a determination of eligibility.</p></details>}
 </section>;
}
