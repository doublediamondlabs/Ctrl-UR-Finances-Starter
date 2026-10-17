import OverviewUtilities from './OverviewUtilities.jsx';
import { loanOverview } from './loanOverview.js';
import ReviewQueue from './ReviewQueue.jsx';
import { LinkLockBar } from './LinkGuard.jsx';
import { TaskCards, TaskColorPicker, orderedTasks } from './TaskCards.jsx';
import { DebtCards } from './DebtTrackers.jsx';
import React, { useState, useEffect } from 'react';
import { entries, totals } from './analytics.js';
import { calculateLoan } from './loan.js';
export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const cash = n => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(n);
export const when = s => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleString(undefined, s.length === 10 ? {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
} : {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
}) : 'Not recorded';
export function Cue({
  state = 'neutral',
  children
}) {
  return <span className={'status-cue cue-' + state}><span aria-hidden="true">●</span> {children}</span>;
}
export function deadlineStatus(item, today = localDate()) {
  if (item.completed) return {
    state: 'green',
    label: 'Completed'
  };
  if (!item.due) return {
    state: 'neutral',
    label: 'Not configured'
  };
  const days = Math.round((Date.parse(item.due + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
  return days < 0 ? {
    state: 'red',
    label: 'Overdue'
  } : days <= item.warningDays ? {
    state: 'amber',
    label: days === 0 ? 'Due today' : 'Due soon'
  } : {
    state: 'neutral',
    label: 'Upcoming'
  };
}
export function BackupStatus({
  data
}) {
  return <><Cue state={data?.state}>{data?.label || 'Not checked'}</Cue>{data?.created && <p>Backup started: <strong>{when(data.created)}</strong></p>}{data?.completedAt && <p>Verified complete: <strong>{when(data.completedAt)}</strong></p>}{data?.created && !data?.completedAt && <small>Completion time was not recorded by the older version.</small>}{data?.checked && <small>Last status check: {when(data.checked)}</small>}{data?.detail && <p>{data.detail}</p>}</>;
}
export default function Overview({
  modules = {
    business: true,
    inspections: true,
    loans: true,
    family: true
  },
  yearNavigation,
  book,
  year,
  reporting,
  loanState,
  api,
  onOpen,
  onReviewMonth,
  onReviewTask,
  onDirty,
  onReload,
  debtLoans = [],
  debtBooks = []
}) {
  const [items, setItems] = useState(null),
    [backup, setBackup] = useState(null),
    [error, setError] = useState(''),
    [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false),
    [checked, setChecked] = useState('');
  const today = localDate();
  async function load() {
    setBusy(true);
    setError('');
    try {
      const r = await api('deadlines');
      setItems(r.items);
      setBackup(await api('backup/status'));
      setChecked(new Date().toISOString());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    onDirty(!!draft || busy);
    return () => onDirty(false);
  }, [!!draft, busy]);
  async function persist(next) {
    setBusy(true);
    setError('');
    try {
      const r = await api('deadlines', {
        previous: items,
        items: next
      });
      setItems(r.items);
      setDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function copyTask(item) {
    const {
      id,
      completed,
      created,
      updated,
      nextId,
      rank,
      recurrenceDay,
      ...fields
    } = item;
    setDraft({
      ...fields,
      id: crypto.randomUUID(),
      due: '',
      completed: ''
    });
  }
  function edit(item) {
    setDraft(item ? {
      ...item
    } : {
      id: crypto.randomUUID(),
      title: '',
      area: modules.business ? 'Business' : 'Personal',
      due: '',
      warningDays: 30,
      repeat: 'annual',
      note: '',
      completed: '',
      color: 'slate'
    });
  }
  const visibleItems = (items || []).filter(i => i.area !== 'Business' || modules.business).filter(i => i.area !== 'Family' || modules.family);
  const display = orderedTasks(visibleItems).filter(i => history || !i.completed);
  function summary(domain, title, destination) {
    const rows = book ? entries(book, reporting, domain) : [],
      t = totals(rows);
    return <article className="overview-card"><h2>{title}</h2>{book ? <><dl><div><dt>Recorded income</dt><dd>{cash(t.income)}</dd></div><div><dt>Recorded spending</dt><dd>{cash(t.expense)}</dd></div><div><dt>{t.net < 0 ? 'Deficit' : 'Surplus'}</dt><dd className={t.net < 0 ? 'amount-negative' : 'amount-positive'}>{cash(t.net)}</dd></div></dl>{t.missing > 0 && <p className="report-incomplete">{t.missing} recorded entries have missing amounts.</p>}<ReviewQueue inspectionsEnabled={!!modules.inspections} book={book} reporting={reporting} domain={domain} busy={busy || !!draft} onContinue={onReviewTask || (task => onReviewMonth?.(task.month))} /></> : <Cue>Workbook not loaded</Cue>}<button onClick={() => onOpen(destination)}>Open {title}</button></article>;
  }
  let loan;
  try {
    if (loanState?.loan) loan = calculateLoan(loanState.loan, today);
  } catch {}
  const loanPosition = loan ? loanOverview(loan, today) : null;
  return <div className="overview"><OverviewUtilities years={yearNavigation} backup={backup} backupDetails={<BackupStatus data={backup} />} busy={busy || !!draft} onRecovery={() => onOpen('recovery')} /><div className="overview-actions"><button disabled={busy || !!draft} onClick={() => onOpen('summary')}>Year-end Summary · Spending Mix</button><button disabled={busy || !!draft} onClick={async () => {
        await onReload();
        await load();
      }}>Refresh Overview</button><span>Overview checked {when(checked)}</span></div><div className="overview-grid">{modules.business && summary('business', 'Business', 'month')}{summary('personal', 'Personal', 'home')}{modules.family && <article className="overview-card"><h2>Family loan</h2>{loan ? <><dl><div><dt>Received to date</dt><dd>{cash(loan.paid)}</dd></div><div><dt>Remaining principal</dt><dd>{cash(loan.balance)}</dd></div><div><dt>Overall shortfall</dt><dd>{cash(loan.arrears)}</dd></div></dl><Cue state={loanPosition.tone}>{loanPosition.label}</Cue><p>{loanPosition.next ? 'Next Due ' + when(loanPosition.next.due) : loan.balance === 0 ? 'No further installments due' : 'No future installment scheduled · review remaining balance'}</p><div className="entry-guidance"><strong>Status as of {when(today)}</strong><p>Based on recorded payments. Any overdue amount appears in Overall Shortfall above.</p></div></> : <Cue>Loan unavailable or not linked</Cue>}<button onClick={() => onOpen('loan')}>Open Family Loan</button></article>}</div>
 {modules.loans && <><div className="overview-actions"><button disabled={busy || !!draft} onClick={() => onOpen('debt_new')}>Add Loan Tracker</button><button disabled={busy || !!draft} onClick={() => onOpen('debts')}>Manage Loan Trackers</button></div><div className="overview-grid"><DebtCards loans={debtLoans} books={debtBooks} onOpen={onOpen} /></div></>}<section className="panel"><div className="panel-heading"><h2>Upcoming dates & tasks</h2><button disabled={busy || items === null || !!draft} onClick={() => edit()}>Add Deadline</button></div><p className="hint">Your dates and priorities, across all years. In-app reminders appear when you open this screen.</p>{error && <p className="error" role="alert">{error}</p>}{!draft && <button disabled={busy} onClick={load}>Reload Deadlines & Backup Status</button>}{draft ? <form className="deadline-form" onSubmit={e => {
        e.preventDefault();
        persist(items.some(i => i.id === draft.id) ? items.map(i => i.id === draft.id ? draft : i) : [...items, draft]);
      }}><fieldset disabled={busy}><legend>{items.some(i => i.id === draft.id) ? 'Edit deadline' : 'New deadline'}</legend><label>Title<input required maxLength={200} value={draft.title} onChange={e => setDraft({
              ...draft,
              title: e.target.value
            })} /></label><div className="form-grid"><label>Area<select value={draft.area} onChange={e => setDraft({
                ...draft,
                area: e.target.value
              })}>{['Business', 'Personal', 'Family', 'Other'].filter(a => a !== 'Business' || modules.business).filter(a => a !== 'Family' || modules.family).map(a => <option key={a}>{a}</option>)}</select></label><label>Due date<input type="date" required value={draft.due} onChange={e => setDraft({
                ...draft,
                due: e.target.value
              })} /></label><label>Warn days before<input type="number" required min="0" max="365" value={draft.warningDays} onChange={e => setDraft({
                ...draft,
                warningDays: Number(e.target.value)
              })} /></label><label>Repeat<select value={draft.repeat} onChange={e => setDraft({
                ...draft,
                repeat: e.target.value
              })}><option value="monthly">Monthly after completion</option><option value="annual">Annually after completion</option><option value="none">One time</option></select></label><label>Completed date (optional)<input type="date" max={today} value={draft.completed} onChange={e => setDraft({
                ...draft,
                completed: e.target.value
              })} /></label></div><TaskColorPicker value={draft.color || 'slate'} onChange={color => setDraft({
            ...draft,
            color
          })} /><label>Notes<textarea maxLength={5000} value={draft.note} onChange={e => setDraft({
              ...draft,
              note: e.target.value
            })} /></label><p className="hint">A completion date preserves this occurrence as history. Monthly and annual tasks create one next occurrence from the scheduled due date, not the completion date. Monthly dates keep the same day, using the last day for shorter months. Review weekends and other date changes before saving.</p><button className="primary">Save Deadline</button> <button type="button" onClick={() => setDraft(null)}>Cancel</button></fieldset></form> : <><label className="check-label"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />Show completed history</label>{items !== null && !items.length && <p><Cue>Not configured</Cue> Add the obligations you want to track.</p>}{items?.length > 0 && !display.length && <p>No open deadlines. Completed history is available above.</p>}<TaskCards items={visibleItems} display={display} busy={busy} today={today} onEdit={edit} onCopy={copyTask} onSave={next => persist([...(items || []).filter(i => !visibleItems.some(v => v.id === i.id)), ...next])} /></>}</section></div>;
}
