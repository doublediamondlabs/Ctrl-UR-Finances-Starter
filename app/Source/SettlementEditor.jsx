import React, { useState } from 'react';
import { ledger, settlementEvents, jobLabel, payoutStatus, MONTHS } from './inspectionIncome.js';
export const evidenceTypes = [['bank', 'Bank statement'], ['processor', 'Payment processor payout detail'], ['scheduling', 'Scheduling / customer payment record'], ['other', 'Other evidence']];
export const money = n => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(n);
export function Guidance({
  title = 'Guidance',
  children
}) {
  return <div role="note" className="entry-guidance" aria-label={title}><strong>{title}</strong><div>{children}</div></div>;
}
export function confirmationProblem(book, data) {
  const s = payoutStatus(book, data);
  if (!data.items.length) return 'Select the customer payments or refunds that make up this bank transaction.';
  if (s.difference) return `Bank ${Number(data.amount) < 0 ? 'withdrawal' : 'deposit'} ${money(Number(data.amount))}; selected payments/refunds ${money(s.selected)}; difference ${money(s.difference)}. Check the selected entries against this one bank transaction.`;
  if (s.issues.length) return s.issues.join(' · ') + '. Review the connected payment dates and amounts.';
  return '';
}
export function verificationNote(data) {
  if (!data.bankAccount?.trim() || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.statementMonth || '')) return '';
  return `Visually verified against the ${data.bankAccount.trim()} bank statement for ${MONTHS[Number(data.statementMonth.slice(5, 7)) - 1]} ${data.statementMonth.slice(0, 4)}.`;
}
export function SourceHelp({
  children
}) {
  return <details className="source-help"><summary>? Where does this come from?</summary><p>{children}</p></details>;
}
export function statementLabel(p) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p.statementMonth || '') ? `${MONTHS[Number(p.statementMonth.slice(5, 7)) - 1]} ${p.statementMonth.slice(0, 4)} bank statement${p.bankAccount ? ' · ' + p.bankAccount : ''}` : 'Statement month not recorded';
}
export function MonthChoice({
  value,
  onChange,
  year,
  label,
  disabled = false
}) {
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(value || ''),
    [chosenYear, setChosenYear] = useState(valid ? value.slice(0, 4) : String(year));
  const displayYear = valid ? value.slice(0, 4) : chosenYear,
    month = valid ? value.slice(5, 7) : '';
  const years = [...new Set([...Array.from({
    length: 11
  }, (_, i) => String(Number(year) - 5 + i)), displayYear])].sort();
  return <div className="month-choice"><label>{label}<select disabled={disabled} value={month} onChange={e => onChange(e.target.value ? displayYear + '-' + e.target.value : '')}><option value="">Choose month</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}</select></label><label>{label === 'Statement month' ? 'Statement year' : 'Payment / refund year'}<select disabled={disabled} value={displayYear} onChange={e => {
        setChosenYear(e.target.value);
        if (month) onChange(e.target.value + '-' + month);
      }}>{years.map(y => <option key={y}>{y}</option>)}</select></label></div>;
}
export default function SettlementEditor({
  book,
  data,
  onChange,
  initialMonth
}) {
  const [query, setQuery] = useState(''),
    [filterMonth, setFilterMonth] = useState(data.date?.slice(0, 7) || initialMonth || String(book.year) + '-01'),
    [allMonths, setAllMonths] = useState(false),
    [showLinked, setShowLinked] = useState(false),
    [direction, setDirection] = useState(Number(data.amount) < 0 ? 'withdrawal' : 'deposit');
  const l = ledger(book),
    events = settlementEvents(book),
    status = payoutStatus(book, data),
    selected = new Set(data.items.map(x => x.eventId));
  const missing = data.items.filter(item => !events.some(e => e.id === item.eventId));
  const change = patch => onChange({
    ...data,
    ...patch
  });
  const rows = events.map(e => ({
    ...e,
    elsewhere: l.payouts.find(p => p.id !== data.id && p.items.some(x => x.eventId === e.id))
  })).filter(e => selected.has(e.id) || (showLinked || !e.elsewhere) && (allMonths || (e.date ? e.date.slice(0, 7) === filterMonth : Number(e.ownerYear) === Number(filterMonth.slice(0, 4)) && MONTHS.indexOf(e.month) + 1 === Number(filterMonth.slice(5, 7)))) && `${jobLabel(book, e.jobId)} ${e.note || ''} ${e.amount}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.id.localeCompare(b.id));
  return <div className="settlement-editor"><h3>Bank Settlement</h3><section><h3>1. What appears on the bank statement?</h3><Guidance title="One bank transaction"><p>Enter one posted deposit or withdrawal—not the month’s total. A single deposit can include several customer payments and refunds. Copy its actual date and amount from your bank statement.</p></Guidance><div className="form-grid"><MonthChoice label="Statement month" year={book.year} value={data.statementMonth || ''} onChange={statementMonth => change({
          statementMonth
        })} /><label>Bank / Account<input maxLength={200} value={data.bankAccount || ''} onChange={e => change({
            bankAccount: e.target.value
          })} placeholder="e.g. Banterra · Business checking" /></label></div><p className="statement-source">Source: {statementLabel(data)}</p><SourceHelp>Choose the month printed on the statement and identify the bank/account. This is recorded by you; the app has not read or verified a statement. Existing entries stay unspecified until you supply the source.</SourceHelp><div className="form-grid"><label>Date posted on bank statement<input required type="date" value={data.date} onChange={e => change({
            date: e.target.value
          })} /></label><label>Transaction direction<select value={direction} onChange={e => {
            setDirection(e.target.value);
            change({
              amount: data.amount === '' ? '' : Math.abs(Number(data.amount)) * (e.target.value === 'withdrawal' ? -1 : 1)
            });
          }}><option value="deposit">Deposit · money into bank</option><option value="withdrawal">Withdrawal · money out of bank</option></select></label><label>Amount on bank statement<input required type="number" step="0.01" min="0.01" value={data.amount === '' ? '' : Math.abs(Number(data.amount))} onChange={e => change({
            amount: e.target.value === '' ? '' : Number(e.target.value) * (direction === 'withdrawal' ? -1 : 1)
          })} /></label></div><SourceHelp>Copy the posted date and amount from the bank transaction on the statement identified above. Enter a positive amount, then choose Deposit or Withdrawal. This connection adds no income. Separately billed processing fees remain Business expenses.</SourceHelp><label>Reference<input maxLength={200} value={data.reference || ''} onChange={e => change({
          reference: e.target.value
        })} placeholder="Statement page, payout ID, or a short reminder" /></label></section>
 <section><h3>2. Which customer payments and refunds make up that amount?</h3><div className="settlement-match"><span>Bank amount<strong>{money(Number(data.amount) || 0)}</strong></span><span>Selected total<strong>{money(status.selected)}</strong></span><span>Difference<strong>{money(status.difference)}</strong></span></div><Guidance title={status.difference === 0 && data.items.length ? "Amounts balance" : "Match this deposit"}><p>{confirmationProblem(book, data) || "Amounts balance. Check that these specific payments and refunds belong to this transaction before choosing Confirmed. Equal totals alone do not verify the connection."}</p><p>Choose Suggested if the connection is not yet verified. This does not add income.</p></Guidance><details className="settlement-search-options"><summary><strong>Find Other Payments & Refunds</strong><span>{allMonths ? 'All Months / Years' : /^\d{4}-(0[1-9]|1[0-2])$/.test(filterMonth) ? MONTHS[Number(filterMonth.slice(5, 7)) - 1] + ' ' + filterMonth.slice(0, 4) : 'No Month Selected'} · {query ? 'Search: ' + query : 'No Search'}{showLinked ? ' · Including Connected Elsewhere' : ''}</span></summary><div className="form-grid"><label>Find customer, description or amount<input value={query} onChange={e => setQuery(e.target.value)} /></label><MonthChoice label="Payment / refund month" year={book.year} disabled={allMonths} value={filterMonth} onChange={setFilterMonth} /></div><div className="settlement-filters"><label><input type="checkbox" checked={allMonths} onChange={e => setAllMonths(e.target.checked)} />Include other months / years</label><label><input type="checkbox" checked={showLinked} onChange={e => setShowLinked(e.target.checked)} />Show connected elsewhere</label></div><Guidance title="Finding payments"><p>Selected entries stay visible even outside your filters. Other payments may be hidden by the search or month/year filters. Use Include other months / years for deposits covering earlier payments.</p>{query && <div className="search-filter-cue"><span>Search active: <b>{query}</b></span><button type="button" onClick={() => setQuery('')}>Clear Search</button></div>}</Guidance></details>{missing.length > 0 && <div className="settlement-missing-links" role="alert"><strong>Old Payment Links Need Removal</strong><p>These saved links no longer point to an available payment or refund. Remove each old link, then select the correct current entries below. This keeps the bank transaction, reference, notes, and customer records. Changes take effect only after Preview Changes and Save Reviewed Changes.</p>{missing.map((item, index) => <div className="missing-link-row" key={item.eventId + ':' + index}><span><strong>{money(Number(item.amount) || 0)}</strong> · {item.date || 'Date Not Recorded'}<small>Unavailable Payment / Refund</small></span><button type="button" onClick={() => change({
            items: data.items.filter(x => x.eventId !== item.eventId),
            status: 'suggested',
            evidenceEdited: true
          })}>Remove Old Link</button></div>)}</div>}<p className="hint">Choose any combination. Rows stay in date order as you check or uncheck them.</p><div className="settlement-table-wrap"><table className="settlement-picker"><thead><tr><th>Select</th><th>Customer</th><th>Payment/refund date</th><th>Type</th><th>Amount</th></tr></thead><tbody>{rows.map(e => <tr key={e.id} className={selected.has(e.id) ? "payment-selected" : ""}><td><input type="checkbox" aria-label={'Select ' + jobLabel(book, e.jobId) + ' ' + e.type} checked={selected.has(e.id)} disabled={!!e.elsewhere} onChange={() => change({
                  items: selected.has(e.id) ? data.items.filter(x => x.eventId !== e.id) : [...data.items, {
                    eventId: e.id,
                    date: e.date,
                    amount: e.type === 'refund' ? -e.amount : e.amount
                  }]
                })} /></td><td><strong>{l.jobs[e.jobId]?.profile?.customerName || jobLabel(book, e.jobId).split(',')[0]}</strong><details><summary>Description & notes</summary><p>{jobLabel(book, e.jobId)}</p><p>{e.note}</p>{book.notes.filter(n => n.recordId === e.jobId).map(n => <p key={n.id}>{n.text}</p>)}</details>{e.elsewhere && <small>Connected to {e.elsewhere.date} · {money(e.elsewhere.amount)}</small>}</td><td>{e.date || e.month + ' ' + e.ownerYear + ' · date not reviewed'}</td><td>{e.type === 'refund' ? 'Refund' : 'Payment'}</td><td>{money(e.type === 'refund' ? -e.amount : e.amount)}</td></tr>)}</tbody></table>{!rows.length && <p>No matching entries. Try Include other months / years or change your search.</p>}</div><SourceHelp>Use the processor payout detail to identify payments and refunds bundled into this bank transaction. Payments may come from another month or linked year. Equal totals alone do not prove which customers belong in a payout.</SourceHelp></section>
 <section><h3>3. What Did You Check?</h3><Guidance title="Before confirming"><p>Record the evidence you personally checked. Confirm only when the selected entries match this bank transaction, the difference is $0.00, and any date or amount issues are resolved. Selecting a source does not mean the app inspected it.</p></Guidance><div className="settlement-evidence">{evidenceTypes.map(([id, label]) => <label key={id}><input type="checkbox" checked={(data.evidence || []).includes(id)} onChange={e => change({
            evidence: e.target.checked ? [...(data.evidence || []), id] : (data.evidence || []).filter(x => x !== id),
            evidenceEdited: true
          })} />{label}</label>)}</div>{(data.evidence || []).includes('other') && <label>Describe other evidence<input maxLength={1000} value={data.otherEvidence || ''} onChange={e => change({
          otherEvidence: e.target.value,
          evidenceEdited: true
        })} /></label>}<SourceHelp>Bank statement: posted date and amount. Processor payout detail: the customer payments and refunds included. Scheduling/customer record: the customer payment details. Record other supporting evidence where needed.</SourceHelp><div className="workflow-decision"><strong>Choose The Verification Status</strong>{data.status !== 'confirmed' && <p className="decision-needed">Needs Your Review</p>}<label>Verification Status<select value={data.status} onChange={e => change({
            status: e.target.value,
            evidenceEdited: true
          })}><option value="suggested">Suggested · not verified</option><option value="confirmed">Confirmed · I Checked The Connection</option></select></label></div>{data.status === 'confirmed' && !(data.evidence || []).length && <p className="hint">Earlier confirmation retained. Its evidence sources were not recorded; you can add them now.</p>}<p className="hint">{data.confirmedAt ? 'Last confirmation recorded: ' + new Date(data.confirmedAt).toLocaleString() : 'Confirmation date not recorded.'}</p><div className="verification-note-action"><button type="button" disabled={!verificationNote(data) || !(data.evidence || []).includes('bank') || (data.note || '').includes(verificationNote(data)) || (data.note || '').length + verificationNote(data).length + 1 > 5000} onClick={() => change({
          note: [data.note, verificationNote(data)].filter(Boolean).join('\n')
        })}>Insert Verification Note</button><small>Uses your bank/account and statement month. Select Bank Statement after checking it. Existing notes are retained.</small></div><label>Settlement Notes<textarea maxLength={5000} value={data.note || ''} onChange={e => change({
          note: e.target.value
        })} placeholder="Explain how you connected the records, exceptions, or reminders for future you." /></label></section></div>;
}
