import RomTransfer from './RomTransfer.jsx';
import { customerNames } from './customerContacts.js';
import InspectionDestination, { applyLocationProfile } from './InspectionDestination.jsx';
import { destinationChanges } from './destinations.js';
import { inspectionSummary, canRemoveOriginal, moveInspectionMonth } from './inspectionIncome.js';
import TravelEditor from './TravelEditor.jsx';
import IncomeList from './IncomeList.jsx';
import { WorkflowStatus, WorkflowReview } from './InspectionWorkflow.jsx';
import { affectedPayouts, readableDate, jobWorkflow, dateSignature, dateWarnings, validateWorkflow, incomeMonth, detailGaps } from './inspectionWorkflow.js';
import VisitsEditor, { newVisit } from './VisitsEditor.jsx';
import InspectionDetails from './InspectionDetails.jsx';
import { emptyProfile, inspectionLabel, locationLabel, duplicateInspections, inspectionCues } from './inspectionDetails.js';
import SettlementEditor, { Guidance, confirmationProblem, evidenceTypes, statementLabel } from './SettlementEditor.jsx';
import React, { useEffect, useState } from 'react';
import { ledger, jobLabel, incomeRecords, travelRecords, mileageNeedsReview, monthlyIncome, payoutStatus, validateLedger, changes, MONTHS, total, settlementEvents, inspectionJobs, crossYearChanges } from './inspectionIncome.js';
const money = n => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(n),
  uid = () => crypto.randomUUID();
export default function InspectionIncome({
  allowRom = false,
  initialTravel = false,
  onTravelClose,
  loadTravelBooks,
  book,
  month,
  onSave,
  busy,
  onDirty,
  requestJob,
  onRequestHandled,
  requestAction,
  onActionHandled,
  showAttention = true,
  reporting = {},
  onSaveReporting,
  onRemoveOriginal,
  onBackReport,
  onMoved
}) {
  const defaults = {
    reportingSoftware: '',
    processor: '',
    bankAccount: '',
    ...reporting.businessDefaults
  };
  const [task, setTask] = useState('home');
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [romOpen, setRomOpen] = useState(allowRom && initialTravel),
    [romVisit, setRomVisit] = useState(null);
  const [savedPayout, setSavedPayout] = useState(null);
  useEffect(() => setSavedPayout(null), [month, book.year]);
  const [savedJob, setSavedJob] = useState(null);
  const [incomeArranging, setIncomeArranging] = useState(false);
  const [step, setStep] = useState(1),
    [matchJob, setMatchJob] = useState(null);
  const [findAll, setFindAll] = useState(false),
    [view, setView] = useState('inspections'),
    [draft, setDraft] = useState(null),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(''),
    [scope, setScope] = useState('month'),
    [query, setQuery] = useState(''),
    [history, setHistory] = useState(null),
    [localBusy, setLocalBusy] = useState(false);
  const l = ledger(book),
    m = MONTHS[month],
    period = book.year + '-' + String(month + 1).padStart(2, '0'),
    pending = romOpen || !!draft || !!preview || !!matchJob || incomeArranging;
  useEffect(() => {
    if (leaveTarget) {
      const dialog = document.getElementById('leave-work-dialog');
      if (dialog && !dialog.open) dialog.showModal();
    }
  }, [leaveTarget]);
  useEffect(() => {
    onDirty(pending);
    return () => onDirty(false);
  }, [pending]);
  useEffect(() => {
    if (requestJob && !pending) {
      editJob(requestJob);
      onRequestHandled?.();
    }
  }, [requestJob]);
  useEffect(() => {
    if (requestAction && !pending) {
      if (requestAction.kind === 'bank_list') {
        setTask('work');
        setView('bank');
      } else if (requestAction.kind === 'bank') {
        beginMatch(requestAction.id);
        if (requestAction.eventId) setMatchJob({
          id: requestAction.id,
          eventId: requestAction.eventId
        });
      } else if (requestAction.kind === 'payout') {
        const p = l.payouts.find(p => p.id === requestAction.id);
        if (p) {
          setView('bank');
          editPayout(p);
        }
      } else {
        setView('inspections');
        editJob(requestAction.id);
      }
      onActionHandled?.();
      setTimeout(() => document.getElementById('inspection-working-area')?.scrollIntoView?.({
        block: 'start',
        behavior: 'smooth'
      }), 0);
    }
  }, [requestAction]);
  const fits = date => Number(date?.slice(0, 4)) === book.year && (scope === 'year' || date?.startsWith(period)),
    rows = incomeRecords(book).filter(r => r.kind === 'inspection' && r.state === 'recorded' && (scope === 'year' || r.month === m)),
    payments = total(rows.filter(r => r.amount > 0)),
    refunds = -total(rows.filter(r => r.amount < 0)),
    costs = total(book.records.filter(r => r.kind === 'expense' && r.scope === 'business' && r.state === 'recorded' && (scope === 'year' || r.month === m))),
    legacy = rows.filter(r => !r.sourceJobId),
    travel = travelRecords(book).filter(r => scope === 'year' || r.month === m),
    periodJobs = inspectionJobs(book).filter(r => findAll || travel.some(v => v.id === r.id) || l.events.some(e => e.jobId === r.id && fits(e.date)) || (r.ownerYear || book.year) === book.year && (scope === 'year' || r.month === m)),
    jobs = periodJobs.filter(r => jobLabel(book, r.id).toLowerCase().includes(query.toLowerCase())),
    settledEvents = settlementEvents(book);
  function editJob(id, action) {
    setSavedPayout(null);
    const r = book.records.find(r => r.id === id) || l.sources?.find(r => r.id === id);
    if (!r) return;
    setTask('work');
    setError('');
    const job = structuredClone(l.jobs[id] || {
      ownerYear: r.ownerYear || book.year,
      date: '',
      status: 'Not reviewed',
      vehicle: '',
      miles: r.miles,
      reason: '',
      visits: [{
        ...newVisit(),
        id: id + ':initial',
        purpose: 'Initial inspection',
        outcome: 'Not reviewed',
        charge: 'included',
        miles: r.miles
      }]
    });
    if (job.entryType !== 'travel') {
      if (!job.profile) job.profile = emptyProfile();
      if (!job.profile.reportingSoftware?.trim()) job.profile.reportingSoftware = defaults.reportingSoftware;
    }
    const events = structuredClone(l.events.filter(e => e.jobId === id));
    if (action === 'travel') {
      if (r.amount || events.length) {
        setError('This entry has income or payments. Keep it as an inspection.');
        return;
      }
      job.entryType = 'travel';
      job.travelDescription = r.description || 'Unidentified travel';
      job.travelPurpose = '';
      job.travelReview = 'research';
      delete job.profile;
      job.visits = job.visits.map(v => ({
        ...v,
        purpose: 'Other travel',
        charge: 'courtesy'
      }));
      job.paymentState = 'no_charge';
    }
    if (action === 'visit') job.visits.push(newVisit());
    if (['payment', 'refund'].includes(action)) events.push({
      id: uid(),
      jobId: id,
      date: '',
      type: action,
      amount: null,
      method: defaults.processor,
      note: ''
    });
    setStep(['payment', 'refund'].includes(action) ? 2 : 1);
    setDraft({
      kind: 'job',
      id,
      job,
      events,
      paymentState: events.some(e => e.type === 'payment') ? 'received' : job.paymentState || 'review',
      bankAction: 'now',
      retire: l.retired.filter(r => r.jobId === id).map(r => r.recordId),
      datesConfirmed: job.dateReview?.signature,
      managed: !!l.jobs[id]
    });
  }
  function beginMove(id) {
    const r = book.records.find(r => r.id === id);
    if (!r) return;
    setSavedJob(null);
    setSavedPayout(null);
    setError('');
    setDraft({
      kind: 'move',
      id,
      from: r.month,
      targetMonth: r.month
    });
  }
  function addInspection() {
    setSavedPayout(null);
    setTask('work');
    setError('');
    setStep(1);
    setView('inspections');
    setDraft({
      kind: 'job',
      id: uid(),
      isNew: true,
      paymentState: '',
      bankAction: '',
      job: {
        ownerYear: book.year,
        visits: [{
          ...newVisit(),
          purpose: 'Initial inspection',
          charge: 'included'
        }],
        date: '',
        status: 'Scheduled',
        vehicle: '',
        miles: null,
        reason: '',
        profile: {
          ...emptyProfile(),
          reportingSoftware: defaults.reportingSoftware
        },
        createdInWorkflow: true
      },
      events: [],
      retire: [],
      managed: true
    });
  }
  function addTravel() {
    setSavedPayout(null);
    setTask('work');
    setError('');
    setStep(1);
    setView('inspections');
    setDraft({
      kind: 'job',
      id: uid(),
      isNew: true,
      managed: true,
      paymentState: 'no_charge',
      bankAction: 'later',
      events: [],
      retire: [],
      job: {
        entryType: 'travel',
        ownerYear: book.year,
        travelDescription: '',
        travelPurpose: '',
        travelReview: 'research',
        date: '',
        status: 'Not reviewed',
        vehicle: '',
        miles: null,
        reason: '',
        visits: [{
          ...newVisit(),
          purpose: 'Other travel',
          charge: 'courtesy',
          outcome: 'Not reviewed'
        }]
      }
    });
  }
  function navigate(target) {
    setSavedPayout(null);
    setSavedJob(null);
    if (target === 'edit') {
      setPreview(null);
      return;
    }
    setDraft(null);
    setPreview(null);
    setMatchJob(null);
    setIncomeArranging(false);
    setError('');
    setLeaveTarget(null);
    setTask(target === 'list' ? 'work' : target);
    if (target === 'report') onBackReport?.();
  }
  function requestNavigation(target) {
    if (locked) return;
    if (target === 'edit') {
      navigate(target);
      return;
    }
    if (pending) setLeaveTarget(target);else navigate(target);
  }
  const backDestination = preview && draft ? 'edit' : draft || matchJob ? draft?.isNew ? 'home' : 'list' : 'review';
  function goToMissing() {
    setStep(1);
    setTimeout(() => {
      const p = draft?.job.profile || {},
        key = [['customerName', true], ['rvMake', true], ['rvModel', true], ['locationType', true], ['dealerName', p.locationType === 'dealer'], ['city', true], ['state', true]].find(([k, needed]) => needed && !p[k]?.trim())?.[0];
      const target = key ? document.querySelector('[data-detail="' + key + '"]') : [...document.querySelectorAll('.visit-editor input,.visit-editor select')].find(el => !el.value || el.value === 'Not reviewed');
      if (target?.closest('.visit-editor')) target.closest('.visit-editor').open = true;
      target?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center'
      });
      target?.focus();
    }, 0);
  }
  function editPayout(p) {
    setSavedPayout(null);
    setTask('work');
    setError('');
    setDraft({
      kind: 'payout',
      data: p ? structuredClone(p) : {
        id: uid(),
        date: period + '-01',
        amount: '',
        bankAccount: defaults.bankAccount,
        reference: '',
        note: '',
        status: 'suggested',
        items: []
      }
    });
  }
  function nextBook() {
    if (draft.kind === 'move') return moveInspectionMonth(book, draft.id, draft.targetMonth);
    const b = structuredClone(book);
    b.inspectionLedger = structuredClone(l);
    const n = b.inspectionLedger;
    if (draft.kind === 'job') {
      validateWorkflow(draft, book);
      if (duplicateInspections(book, draft.id, draft.job).length && !draft.allowDuplicate) throw Error('Possible duplicate: review the matching inspection and check the intentional-repeat box to continue.');
      if (draft.isNew) {
        const p = draft.job.profile;
        b.records.push({
          id: draft.id,
          month: m,
          kind: 'inspection',
          category: 'Inspection',
          subCategory: '',
          description: draft.job.entryType === 'travel' ? draft.job.travelDescription : inspectionLabel(p),
          location: draft.job.entryType === 'travel' ? '' : locationLabel(p),
          amount: 0,
          miles: null,
          sheet: m,
          isNew: true,
          state: 'recorded',
          scope: 'business',
          percent: null,
          recurringType: 'fixed'
        });
      }
      n.jobs[draft.id] = {
        ...draft.job,
        visits: draft.job.visits.map(({
          destinationSave,
          destinationReminderSave,
          ...v
        }) => v),
        paymentState: draft.paymentState,
        dateReview: draft.datesConfirmed === dateSignature(draft) ? {
          signature: dateSignature(draft),
          confirmedAt: draft.job.dateReview?.signature === dateSignature(draft) ? draft.job.dateReview.confirmedAt : new Date().toISOString()
        } : null,
        detailsPending: detailGaps(draft.job).length > 0,
        ...(draft.allowDuplicate ? {
          duplicateAcknowledged: true
        } : {})
      };
      n.events = [...n.events.filter(e => e.jobId !== draft.id), ...draft.events];
      n.retired = [...n.retired.filter(r => r.jobId !== draft.id), ...draft.retire.map(recordId => ({
        recordId,
        jobId: draft.id,
        reason: 'Original refund entry consolidated into dated inspection history.'
      }))];
    } else if (draft.kind === 'payout') {
      const p = {
        ...draft.data,
        amount: Number(draft.data.amount)
      };
      const old = l.payouts.find(x => x.id === p.id);
      if (p.status === 'confirmed' && (old?.status !== 'confirmed' || p.evidenceEdited)) {
        if (!p.evidence?.length) throw Error('Select the evidence you checked before confirming.');
        if (p.evidence.includes('other') && !p.otherEvidence?.trim()) throw Error('Describe the other evidence you checked.');
        p.confirmedAt = new Date().toISOString();
      }
      delete p.evidenceEdited;
      n.payouts = [...n.payouts.filter(x => x.id !== p.id), p];
    }
    validateLedger(b);
    return b;
  }
  function beginMatch(id) {
    setSavedPayout(null);
    setTask('work');
    const candidates = l.events.filter(e => e.jobId === id && !l.payouts.some(p => p.items.some(x => x.eventId === e.id) && payoutStatus(book, p).label === 'Confirmed'));
    setError('');
    setView('bank');
    setMatchJob({
      id,
      eventId: candidates[0]?.id || ''
    });
  }
  function openMatch(p) {
    const event = l.events.find(e => e.id === matchJob.eventId);
    if (!event) return;
    const elsewhere = l.payouts.find(x => x.items.some(i => i.eventId === event.id));
    if (elsewhere && elsewhere.id !== p?.id) {
      setError('This payment already belongs to another deposit. Open its existing connection to review it.');
      return;
    }
    const data = p ? structuredClone(p) : {
      id: uid(),
      date: '',
      amount: '',
      bankAccount: defaults.bankAccount,
      reference: '',
      note: '',
      status: 'suggested',
      items: []
    };
    if (!data.items.some(x => x.eventId === event.id)) {
      data.items.push({
        eventId: event.id,
        date: event.date,
        amount: event.type === 'refund' ? -event.amount : event.amount
      });
      data.status = 'suggested';
    }
    editPayout(data);
    setMatchJob(null);
  }
  async function prepare(event) {
    event?.preventDefault();
    if (draft?.kind === 'job' && draft.job.entryType !== 'travel' && step < 3) {
      setStep(step + 1);
      return;
    }
    setError('');
    try {
      if (draft.kind === 'job') destinationChanges(reporting.savedDestinations || [], draft.job.visits);
      const b = nextBook();
      if (draft.kind === 'payout' && draft.data.status === 'confirmed') {
        const s = payoutStatus(b, draft.data);
        if (s.difference || s.issues.length || !draft.data.items.length) throw Error(confirmationProblem(b, draft.data));
      }
      setPreview(b);
    } catch (e) {
      setError(e.message);
      if (draft?.kind === 'job') {
        if (/step 2|payment|refund/i.test(e.message)) setStep(2);else if (/step 3/i.test(e.message)) setStep(3);else setStep(1);
      }
    }
  }
  function continueBank(id, b = book) {
    setSavedJob(null);
    const data = ledger(b),
      events = data.events.filter(e => e.jobId === id);
    const event = events.find(e => !data.payouts.some(p => p.items.some(x => x.eventId === e.id) && payoutStatus(b, p).label === 'Confirmed'));
    setView('bank');
    setTask('work');
    if (!event) {
      setSavedJob(id);
      return;
    }
    const existing = data.payouts.find(p => p.items.some(x => x.eventId === event.id));
    if (existing) {
      editPayout(existing);
      return;
    }
    setMatchJob({
      id,
      eventId: event.id
    });
  }
  async function commit() {
    setLocalBusy(true);
    setError('');
    try {
      const destinations = draft?.kind === 'job' ? destinationChanges(reporting.savedDestinations || [], draft.job.visits) : null;
      if (await onSave(preview, undefined, destinations?.changes.length ? {
        previous: reporting.savedDestinations || [],
        items: destinations.items
      } : undefined)) {
        const saved = preview,
          entry = draft;
        setPreview(null);
        setDraft(null);
        if (entry?.kind === 'move') {
          setTask('work');
          setView('inspections');
          setScope('month');
          setFindAll(false);
          setQuery('');
          onMoved?.(MONTHS.indexOf(entry.targetMonth));
        }
        if (entry?.kind === 'payout') {
          setSavedJob(null);
          setSavedPayout(entry.data.id);
          setView('bank');
          setTask('work');
        }
        if (entry?.kind === 'job' && entry.job.entryType !== 'travel') {
          setSavedJob(entry.id);
          if (entry.bankAction === 'now') continueBank(entry.id, saved);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalBusy(false);
    }
  }
  function showHistory(id) {
    setHistory(history === id ? null : id);
  }
  const periodPayouts = l.payouts.filter(p => fits(p.date));
  const needsAttention = periodPayouts.filter(p => payoutStatus(book, p).label !== 'Confirmed');
  const confirmed = periodPayouts.filter(p => payoutStatus(book, p).label === 'Confirmed');
  function attentionRow(p) {
    const status = payoutStatus(book, p),
      tone = status.label === 'Confirmed' ? 'good' : status.label === 'Suggested' ? 'amber' : 'red';
    return <article className={'settlement-attention ' + tone} key={p.id}><strong>{p.date} · {money(p.amount)}</strong><span className={'settlement-status ' + tone}>{status.label === 'Suggested' ? 'Needs confirmation' : status.label}</span><p>{p.items.map(x => {
          const event = settledEvents.find(e => e.id === x.eventId);
          return event ? `${jobLabel(book, event.jobId)}: ${event.type === 'refund' ? 'refund −' : 'payment +'}${money(event.amount)}` : 'Missing linked event';
        }).join(' · ') || 'No customer payments or refunds connected.'}</p>{status.difference !== 0 && <p>Difference to resolve: {money(status.difference)}</p>}{status.issues.map((issue, i) => <p key={i}>{issue}</p>)}<p className="hint">{status.label === 'Confirmed' ? 'Marked confirmed. Open the connection to see the recorded evidence.' : status.label === 'Suggested' ? 'Amounts balance. Check which customers and refunds are in the processor payout, then choose Confirmed and preview/save.' : 'Open the settlement and review its selections against the processor payout detail.'}</p><button disabled={locked || pending} onClick={() => {
        setView('bank');
        editPayout(p);
      }}>{status.label === 'Confirmed' ? "View Connection" : "Review Connection"}</button></article>;
  }
  const openJobs = periodJobs.filter(r => {
      const w = jobWorkflow(book, r.id);
      return w.gaps.length || w.paymentReview || w.bankReview;
    }),
    unmatchedEvents = periodJobs.flatMap(r => l.events.filter(e => e.jobId === r.id && !l.payouts.some(p => p.items.some(x => x.eventId === e.id) && payoutStatus(book, p).label === 'Confirmed')));
  const matchEvent = matchJob && l.events.find(e => e.id === matchJob.eventId),
    matchConnection = matchEvent && l.payouts.find(p => p.items.some(x => x.eventId === matchEvent.id));
  const locked = busy || localBusy;
  const reviewChanges = preview ? crossYearChanges(book, preview) : [],
    reviewPayouts = preview ? affectedPayouts(book, preview) : [];
  if (allowRom && romOpen) return <RomTransfer initialVisit={romVisit} loadTravelBooks={loadTravelBooks} book={book} onSave={onSave} busy={locked} onClose={() => {
    setRomOpen(false);
    setRomVisit(null);
    if (initialTravel) onTravelClose?.();
  }} />;
  if (task !== 'work' && !pending) return <section id="inspection-working-area" className="panel inspection-task-start"><div className="section-title"><div><h2>{m} {book.year} · Inspections & Income</h2><p className="hint">{task === 'home' ? 'What Would You Like To Do?' : 'Which Records Would You Like To Work On?'}</p></div>{task === 'review' && <div className="workspace-navigation">{onBackReport && <button disabled={locked} onClick={() => requestNavigation('report')}>Back To Report</button>}<button disabled={locked} onClick={() => navigate('home')}>← Back</button><button disabled={locked} onClick={() => navigate('home')}>Change Task</button></div>}</div><div className="inspection-task-cards">{task === 'home' ? <><button disabled={locked} onClick={addInspection}><strong>Add Inspection</strong><span>Customer, visit, payment and bank steps</span></button><button disabled={locked} onClick={addTravel}><strong>Add Mileage-Only Travel</strong><span>Travel without a customer payment</span></button><button disabled={locked} onClick={() => setTask('review')}><strong>Review Existing Records</strong><span>Income, inspections or bank matching</span></button>{allowRom && <button disabled={locked} onClick={() => setRomOpen(true)}><strong>RōM · Inspection Travel</strong><span>Export a scheduled visit or review returned trip results</span></button>}</> : [['income', 'Income & Refunds', 'Review payments, refunds and their dates'], ['inspections', 'Inspections & Mileage', 'Review customers, visits and travel'], ['bank', 'Bank Reconciliation', 'Match receipts and refunds to bank transactions']].map(([key, label, help]) => <button key={key} disabled={locked} onClick={() => {
        setView(key);
        setTask('work');
      }}><strong>{label}</strong><span>{help}</span></button>)}</div><p className="hint">{task === 'home' ? 'Continue in Monthly Inspection Progress opens the item needing attention directly.' : 'Select an area to show its records and controls.'}</p></section>;
  return <section id="inspection-working-area" className="panel inspection-income"><div className="section-title inspection-title-row"><div><p className="workspace-breadcrumb">Inspections & Income → {draft?.isNew ? 'New Entry' : 'Review Existing Records'}</p><h2 className="inspection-period-heading">{draft?.isNew ? m + ' ' + book.year : scope === 'year' ? 'All of ' + book.year : m + ' ' + book.year} · {draft?.isNew ? draft.job.entryType === 'travel' ? 'Add Mileage-Only Travel' : 'Add Inspection' : matchJob ? 'Match To Bank Deposit' : {
            income: 'Income & Refunds',
            inspections: 'Inspections & Mileage',
            bank: 'Bank Reconciliation'
          }[view]}</h2></div><div className="workspace-navigation">{onBackReport && <button disabled={locked} onClick={() => requestNavigation('report')}>Back To Report</button>}<button disabled={locked || !!leaveTarget} onClick={() => requestNavigation(backDestination)}>← Back</button><button disabled={locked || !!leaveTarget} onClick={() => requestNavigation('home')}>Change Task</button></div>{!pending && view === 'bank' && <button className="primary" disabled={locked} onClick={() => editPayout()}>Add Bank Settlement</button>}{!pending && <label>Period<select value={scope} onChange={e => setScope(e.target.value)}><option value="month">{m} {book.year}</option><option value="year">All of {book.year}</option></select></label>}</div>
 {leaveTarget && <dialog id="leave-work-dialog" className="leave-work-confirmation" onCancel={e => {
      e.preventDefault();
      setLeaveTarget(null);
    }} role="alertdialog" aria-modal="true" aria-labelledby="leave-work-title" aria-describedby="leave-work-description"><h3 id="leave-work-title">Leave This Work?</h3><p id="leave-work-description">Your unsaved entry or arrangement will be discarded. Saved workbook records will not change.</p><div className="workspace-navigation"><button autoFocus className="primary" onClick={() => setLeaveTarget(null)}>Keep Editing</button><button onClick={() => navigate(leaveTarget)}>Discard Changes & Go Back</button></div></dialog>}
 <div inert={!!leaveTarget}>

 {error && <div className="error" role="alert">{error}{draft?.kind === 'job' && draft.job.entryType !== 'travel' && /customer|dealer|city|state|RV|Private Sale/i.test(error) && <button type="button" onClick={goToMissing}>Go To Missing Details</button>}</div>}
{savedPayout && !pending && view === 'bank' && <section className="bank-saved-next" role="status"><div><strong>Bank Connection Saved</strong><p>{(() => {
              const p = l.payouts.find(p => p.id === savedPayout);
              return p ? `${readableDate(p.date)} · ${money(p.amount)} · ${payoutStatus(book, p).label}` : '';
            })()}</p></div><div className="bank-saved-actions"><button className="primary" disabled={locked} onClick={() => {
            setSavedPayout(null);
            setSavedJob(null);
            setScope('month');
            setFindAll(false);
            setQuery('');
            setView('inspections');
            setTask('work');
          }}>Continue Reviewing Inspections</button><button disabled={locked} onClick={addInspection}>Add Inspection</button><button disabled={locked} onClick={() => setSavedPayout(null)}>Stay Here</button></div></section>}
{savedJob && !pending && <section className="workflow-decision" role="status"><strong>{jobLabel(book, savedJob)} · Inspection Saved</strong>{jobWorkflow(book, savedJob).events.length === 0 ? <p>No customer payment recorded. Bank matching becomes available after recording a payment.</p> : jobWorkflow(book, savedJob).bankReview ? <><p>Next: Match And Verify The Bank Connection</p><button className="primary" onClick={() => continueBank(savedJob)}>Continue To Bank Verification</button></> : <><p>Bank Verified · {l.payouts.filter(p => p.items.some(x => l.events.some(e => e.id === x.eventId && e.jobId === savedJob))).map(p => readableDate(p.date)).join(' · ')}</p><p className="hint">Existing connections are confirmed. No repeat verification is required.</p></>}<button onClick={() => setSavedJob(null)}>{jobWorkflow(book, savedJob).bankReview ? 'Finish Later' : 'Done'}</button></section>}
 {scope === 'year' && <p className="hint">Showing all {book.year} entries below. The financial summary above remains on {m} {book.year}.</p>}
 {legacy.length > 0 && <p className="notice">{legacy.length} original entries retain their existing month. Their payment dates have not been reviewed; totals are a mixture of original entries and dated activity until converted.</p>}

 {showAttention && !pending && <details className="income-attention" open><summary>What still needs attention? <span>{unmatchedEvents.length} customer payment{unmatchedEvents.length === 1 ? ' or refund needs' : 's / refunds need'} bank matching · {periodPayouts.length ? `${needsAttention.length} entered settlements to review` : `No ${scope === 'year' ? book.year : m + ' ' + book.year} deposits entered`}</span></summary><Guidance title="What these checks mean"><p>Inspection details, customer payments and bank connections are checked separately. Counts cover the selected period and saved records; they do not establish that every transaction on your statement has been entered.</p></Guidance><details><summary>Review inspection, payment and bank steps ({openJobs.length})</summary>{openJobs.map(r => <div className="workflow-attention-row" key={r.id}><strong>{jobLabel(book, r.id)}</strong><WorkflowStatus book={book} id={r.id} compact onMatch={() => beginMatch(r.id)} /><button onClick={() => editJob(r.id)}>Review Inspection Steps</button></div>)}</details>{needsAttention.map(attentionRow)}{!needsAttention.length && <p>{periodPayouts.length ? 'All entered settlements in this period are marked confirmed.' : 'No bank settlements entered for this period.'}</p>}{confirmed.length > 0 && <details><summary>Confirmed connections ({confirmed.length})</summary>{confirmed.map(attentionRow)}</details>}{scope === 'month' && l.payouts.some(p => Number(p.date.slice(0, 4)) === book.year && !fits(p.date) && payoutStatus(book, p).label !== 'Confirmed') && <button onClick={() => setScope('year')}>Show Review Items Across {book.year}</button>}</details>}
 {matchJob ? <section className="bank-match-chooser"><h3>Match to bank deposit</h3><strong>{jobLabel(book, matchJob.id)}</strong><Guidance><p>Choose a saved payment or refund, then open its existing connection or select the deposit it belongs to. Creating a new connection only prepares a draft; enter the actual bank date and amount before reviewing and saving.</p></Guidance><label>Payment / refund to match<select value={matchJob.eventId} onChange={e => setMatchJob({
            ...matchJob,
            eventId: e.target.value
          })}>{l.events.filter(e => e.jobId === matchJob.id).map(e => <option value={e.id} key={e.id}>{readableDate(e.date)} · {e.type} · {money(e.amount)}</option>)}</select></label>{matchConnection ? <div className="income-tabs"><button onClick={() => openMatch(matchConnection)}>Open Existing Connection · {readableDate(matchConnection.date)} · {money(matchConnection.amount)}</button></div> : <><button className="primary" disabled={!matchEvent} onClick={() => openMatch(null)}>Create New Bank Settlement</button><details><summary>Choose an existing settlement ({l.payouts.length})</summary><p className="hint">All linked years are included. Choose only the transaction supported by your bank/processor records.</p>{l.payouts.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => <button className="match-existing-option" key={p.id} onClick={() => openMatch(p)}>{readableDate(p.date)} · {money(p.amount)} · {payoutStatus(book, p).label}{p.reference ? ' · ' + p.reference : ""}</button>)}</details></>}<button onClick={() => requestNavigation('list')}>Cancel Matching</button></section> : preview ? <div className="income-review"><h3>Review before saving</h3>{draft?.kind === 'move' && <><h4>{jobLabel(book, draft.id)}</h4><p><strong>Move from {draft.from} to {draft.targetMonth} {book.year}.</strong></p><p className="hint">Inspection details, notes, payments and bank connections are preserved. Actual visit and payment dates stay the same.</p></>}{draft?.kind === 'job' && <><h4 className="review-inspection-name">{jobLabel(preview, draft.id)}</h4><WorkflowReview draft={draft} /></>}
<section className="save-impact"><h4>What this save changes</h4>{draft?.kind === 'job' && (draft.job.visits || []).filter(v => v.destinationReminderSave).map(v => <p key={'reminder-' + v.id}><strong>{v.destination?.reminder?.trim() ? 'Update reminder' : 'Clear reminder'}:</strong> {v.destination?.name}</p>)}{draft?.kind === 'job' && (draft.job.visits || []).filter(v => v.destinationSave && v.destination?.name?.trim()).map(v => <p key={v.id}><strong>{v.destinationSave === 'update' ? 'Update saved destination' : 'Save destination'}:</strong> {v.destination.name} · {v.destination.address || 'No address'} · {v.miles} round-trip miles</p>)}{reviewChanges.length ? <table><thead><tr><th>Month / year</th><th>Net receipts before</th><th>After</th><th>Change</th><th>Actual miles before → after</th></tr></thead><tbody>{reviewChanges.map(r => <tr key={r.year + ':' + r.month}><td>{r.month} {r.year}</td><td>{money(r.before)}</td><td>{money(r.after)}</td><td>{money(r.after - r.before)}</td><td>{r.milesBefore} → {r.milesAfter}</td></tr>)}</tbody></table> : <p>Income and mileage totals unchanged.</p>}
{ledger(preview).retired.filter(r => !l.retired.some(x => x.recordId === r.recordId)).map(r => <p key={r.recordId}><strong>Exclude old income row:</strong> {jobLabel(book, r.recordId)} · {money(book.records.find(e => e.id === r.recordId)?.amount || 0)} · {r.reason}</p>)}
{reviewPayouts.length ? <div className="review-affected-connections"><h4>Bank connections affected by this save</h4>{reviewPayouts.map(p => {
              const previous = l.payouts.find(x => x.id === p.id),
                state = payoutStatus(preview, p),
                oldState = previous ? payoutStatus(book, previous) : null;
              return <div key={p.id}><strong>{readableDate(p.date)} · {money(p.amount)}</strong><p>{oldState && oldState.label !== state.label ? oldState.label + ' → ' : ''}{state.label}</p>{state.issues.map((issue, i) => <p className="workflow-warning" key={i}>{issue}</p>)}{state.difference !== 0 && <p className="workflow-warning">Difference to resolve: {money(state.difference)}</p>}<small>{statementLabel(p)} · Evidence: {(p.evidence || []).map(id => evidenceTypes.find(x => x[0] === id)?.[1] || id).join(', ') || 'Not recorded'}</small></div>;
            })}</div> : <p className="hint">No bank connections change.</p>}</section>
<details className="review-saving-help"><summary>How saving works</summary><p>Original worksheet entries and notes are retained. Converted inspection amounts are replaced in financial totals by their dated payments/refunds. Selected old refund or payout rows are excluded from income to avoid duplication.</p><p>Payments and refunds use their actual event dates; miles use each visit date. Bank connections never add income. All linked annual workbooks receive an updated history snapshot when you save.</p></details><div className="income-tabs"><button className="primary" disabled={locked} onClick={commit}>Save Reviewed Changes</button><button disabled={locked} onClick={() => setPreview(null)}>Back Without Saving</button></div></div> : draft ? <form noValidate onSubmit={prepare}><fieldset disabled={locked}>
 {draft.kind === 'move' ? <><h3>Move to Month</h3><p><strong>{jobLabel(book, draft.id)}</strong></p><p>Currently filed in {draft.from} {book.year}.</p><label>Destination month<select value={draft.targetMonth} onChange={e => setDraft({
                ...draft,
                targetMonth: e.target.value
              })}>{MONTHS.map(x => <option key={x} value={x}>{x} {book.year}</option>)}</select></label><p className="hint">This corrects the filing month within {book.year}. Payments, refunds and visits keep their actual dates. The inspection can still appear in another month when it has activity dated there. Undated mileage and unconverted original income follow the filing month; review any total changes before saving.</p></> : draft.kind === 'job' && draft.job.entryType === 'travel' ? <TravelEditor destinations={reporting.savedDestinations || []} job={draft.job} onChange={job => setDraft({
            ...draft,
            job
          })} retainedPeriod={((book.records.find(r => r.id === draft.id) || l.sources?.find(r => r.id === draft.id))?.month || m) + ' ' + draft.job.ownerYear} /> : draft.kind === 'job' ? <><h3>{draft.isNew ? 'New inspection · ' + m + ' ' + book.year : jobLabel(book, draft.id)}</h3>{!draft.isNew && !(book.records.find(r => r.id === draft.id) || l.sources?.find(r => r.id === draft.id))?.amount && !draft.events.length && <Guidance title="Travel Without An Inspection?"><p>If this original entry records only travel, keep its miles without adding customer or payment details.</p><button type="button" onClick={() => setDraft({
                ...draft,
                paymentState: 'no_charge',
                bankAction: 'later',
                job: {
                  ...draft.job,
                  entryType: 'travel',
                  profile: undefined,
                  travelDescription: (book.records.find(r => r.id === draft.id) || l.sources?.find(r => r.id === draft.id))?.description || 'Unidentified travel',
                  travelPurpose: '',
                  travelReview: 'research',
                  visits: draft.job.visits.map(v => ({
                    ...v,
                    purpose: 'Other travel',
                    charge: 'courtesy'
                  }))
                }
              })}>Use Mileage-Only Travel Instead</button></Guidance>}<nav className="workflow-steps" aria-label="Inspection entry steps">{["Inspection & Travel", "Customer Payment", "Bank Connection"].map((label, i) => <button type="button" key={label} aria-pressed={step === i + 1} onClick={() => setStep(i + 1)}>{i + 1} · {label}</button>)}</nav><div hidden={step !== 1}>{!draft.isNew && <details className="original-entry-reference"><summary>Original Description & Notes</summary><p>{(book.records.find(r => r.id === draft.id) || l.sources?.find(r => r.id === draft.id))?.description || 'No original description'}</p>{(l.sources?.find(r => r.id === draft.id)?.notes || book.notes || []).filter(n => n.recordId === draft.id).map(n => <p key={n.id}>{n.text}</p>)}</details>}<InspectionDetails locationControl={<InspectionDestination job={draft.job} items={reporting.savedDestinations || []} onChange={job => setDraft({
                ...draft,
                allowDuplicate: false,
                job
              })} />} allowIncomplete profile={draft.job.profile || emptyProfile()} onChange={profile => setDraft({
                ...draft,
                allowDuplicate: false,
                job: applyLocationProfile(draft.job, profile)
              })} />{detailGaps(draft.job).length > 0 && <Guidance title="Details Still To Review"><p>{detailGaps(draft.job).join(' · ')}</p><button type="button" onClick={goToMissing}>Go To Missing Details</button></Guidance>}{duplicateInspections(book, draft.id, draft.job).length > 0 && <div className="notice duplicate-warning"><strong>Possible duplicate inspection</strong>{duplicateInspections(book, draft.id, draft.job).map(x => <p key={x.id}>{x.label} · {x.date || 'Date not recorded'}</p>)}<label className="income-check"><input type="checkbox" checked={!!draft.allowDuplicate} onChange={e => setDraft({
                    ...draft,
                    allowDuplicate: e.target.checked
                  })} />This is an intentional repeat inspection</label></div>}<label>Overall job status<select value={draft.job.status} onChange={e => setDraft({
                  ...draft,
                  job: {
                    ...draft.job,
                    status: e.target.value
                  }
                })}>{['Not reviewed', 'Scheduled', 'Completed', 'Partially completed', 'Not performed', 'Canceled'].map(x => <option key={x}>{x}</option>)}</select></label><VisitsEditor profile={draft.job.profile} destinations={reporting.savedDestinations || []} visits={draft.job.visits || []} events={draft.events} onChange={visits => setDraft({
                ...draft,
                allowDuplicate: false,
                job: {
                  ...draft.job,
                  visits,
                  date: visits[0]?.date || ''
                }
              })} />
<label>Inspection reason / notes<textarea maxLength={5000} value={draft.job.reason} onChange={e => setDraft({
                  ...draft,
                  job: {
                    ...draft.job,
                    reason: e.target.value
                  }
                })} /></label></div><div hidden={step !== 2}><h3>2 · Customer Payments & Refunds</h3><div className="workflow-decision"><strong>Choose The Customer Payment Status</strong>{(!draft.paymentState || draft.paymentState === 'review') && <p className="decision-needed">Needs Your Review</p>}<label>Customer Payment Status<select value={draft.paymentState} onChange={e => setDraft({
                    ...draft,
                    paymentState: e.target.value
                  })}><option value="">Choose payment status</option><option value="received">Received — enter actual payment below</option><option value="unpaid">Not Yet Received</option><option value="review">Details Need Review</option><option value="no_charge">No Payment Expected / No Charge</option></select></label></div>{!draft.events.length && <p className="hint">No payment recorded. You can save now and record payment later.</p>}{!draft.managed && <p className="notice">This converts the original income amount of {money((book.records.find(r => r.id === draft.id) || l.sources?.find(r => r.id === draft.id))?.amount || 0)} to dated events. Enter the complete payment/refund history to be included. Mileage is not erased when an inspection is canceled or refunded.</p>}
 {draft.events.map((x, i) => <div className="income-event" key={x.id}><p className="income-month-cue">{x.date ? `Counts toward ${incomeMonth(x.date)} income${x.type === 'refund' ? ' (refund deduction)' : ''}` : 'Enter the actual transaction date to assign its income month.'}</p><div className="form-grid"><label>Event<select value={x.type} onChange={e => setDraft({
                      ...draft,
                      events: draft.events.map((v, n) => n === i ? {
                        ...v,
                        type: e.target.value
                      } : v)
                    })}><option value="payment">Customer payment</option><option value="refund">Refund</option></select></label><label>Actual payment / refund date<input type="date" required value={x.date} onChange={e => setDraft({
                      ...draft,
                      events: draft.events.map((v, n) => n === i ? {
                        ...v,
                        date: e.target.value
                      } : v),
                      datesConfirmed: false
                    })} /></label><label>Amount (positive)<input type="number" step="0.01" min="0.01" required value={x.amount ?? ''} onChange={e => setDraft({
                      ...draft,
                      events: draft.events.map((v, n) => n === i ? {
                        ...v,
                        amount: e.target.value === '' ? null : Number(e.target.value)
                      } : v)
                    })} /></label></div><div className="form-grid"><label>Payment applies to visit<select value={x.visitId || ''} onChange={e => setDraft({
                      ...draft,
                      events: draft.events.map((v, n) => n === i ? {
                        ...v,
                        visitId: e.target.value
                      } : v)
                    })}><option value="">Whole job / not assigned</option>{(draft.job.visits || []).map(v => <option key={v.id} value={v.id}>{v.date || 'Date pending'} · {v.purpose}</option>)}</select></label>{x.type === 'payment' && <label>Paid By (optional)<input maxLength={200} placeholder="Person or business that made this payment" value={x.paidBy || ''} onChange={e => setDraft({
                      ...draft,
                      events: draft.events.map((v, n) => n === i ? {
                        ...v,
                        paidBy: e.target.value
                      } : v)
                    })} /></label>}<label>Payment method / processor<input maxLength={100} value={x.method || ''} onChange={e => setDraft({
                      ...draft,
                      events: draft.events.map((v, n) => n === i ? {
                        ...v,
                        method: e.target.value
                      } : v)
                    })} /></label><label>Transaction reference (optional)<input maxLength={200} value={x.reference || ''} onChange={e => setDraft({
                      ...draft,
                      events: draft.events.map((v, n) => n === i ? {
                        ...v,
                        reference: e.target.value
                      } : v)
                    })} /></label></div><label>Payment / refund note<input maxLength={5000} value={x.note} onChange={e => setDraft({
                    ...draft,
                    events: draft.events.map((v, n) => n === i ? {
                      ...v,
                      note: e.target.value
                    } : v)
                  })} /></label><button type="button" onClick={() => setDraft({
                  ...draft,
                  events: draft.events.filter((v, n) => n !== i)
                })}>Remove Event</button></div>)}<div className="income-tabs"><button type="button" onClick={() => setDraft({
                  ...draft,
                  paymentState: 'received',
                  events: [...draft.events, {
                    id: uid(),
                    jobId: draft.id,
                    date: '',
                    type: 'payment',
                    amount: null,
                    method: defaults.processor,
                    note: ''
                  }]
                })}>Record Payment</button><button type="button" onClick={() => setDraft({
                  ...draft,
                  events: [...draft.events, {
                    id: uid(),
                    jobId: draft.id,
                    date: '',
                    type: 'refund',
                    amount: null,
                    method: defaults.processor,
                    note: ''
                  }]
                })}>Record Refund</button></div>
 {dateWarnings(draft.job, draft.events).length > 0 && <div className="workflow-warning" role="alert">{dateWarnings(draft.job, draft.events).map((w, i) => <p key={i}>{w}</p>)}<label className="income-check"><input type="checkbox" checked={draft.datesConfirmed === dateSignature(draft)} onChange={e => setDraft({
                    ...draft,
                    datesConfirmed: e.target.checked ? dateSignature(draft) : null
                  })} />I checked these actual payment/refund dates against my records.</label></div>}{!draft.managed && !draft.events.length && <label className="income-check workflow-warning"><input type="checkbox" checked={!!draft.conversionConfirmed} onChange={e => setDraft({
                  ...draft,
                  conversionConfirmed: e.target.checked
                })} />I understand that saving without dated events removes this original inspection amount from income totals until its payments are recorded.</label>}<details><summary>Consolidate an existing negative refund row</summary>{book.records.filter(r => r.kind === 'inspection' && r.amount < 0 && !r.miles && !l.jobs[r.id] && (!l.retired.some(t => t.recordId === r.id) || draft.retire.includes(r.id))).map(r => <label className="income-check" key={r.id}><input type="checkbox" checked={draft.retire.includes(r.id)} onChange={() => setDraft({
                    ...draft,
                    retire: draft.retire.includes(r.id) ? draft.retire.filter(id => id !== r.id) : [...draft.retire, r.id]
                  })} />{r.month} · {jobLabel(book, r.id)} · {money(r.amount)}</label>)}</details></div><div hidden={step !== 3}><h3>3 · Bank Connection</h3><Guidance title="Customer payment → Bank deposit"><p>Save the customer payment first, then match it to the actual bank deposit—even if that deposit arrives in a different month. One bank deposit can contain several customer payments.</p></Guidance><div className="workflow-decision"><strong>Choose What Happens After Saving</strong><label>Next Bank Step<select value={draft.bankAction} onChange={e => setDraft({
                    ...draft,
                    bankAction: e.target.value
                  })}><option value="">Choose next step</option><option value="later">Finish Later / Keep Existing Connections</option><option value="now">Continue To Bank Verification</option></select></label></div><WorkflowStatus book={book} id={draft.id} /><Guidance title="About the status above"><p>This shows saved data. Changing a connected payment date or amount will flag its settlement for review. Match later preserves existing connections but does not confirm a deposit.</p></Guidance></div><div className="income-tabs">{step > 1 && <button type="button" onClick={() => setStep(step - 1)}>Previous Step</button>}{step < 3 && <button type="button" className="primary" onClick={() => setStep(step + 1)}>{step === 1 ? "Continue To Customer Payment" : "Continue To Bank Connection"}</button>}</div></> : <SettlementEditor book={book} initialMonth={period} data={draft.data} onChange={data => setDraft({
            ...draft,
            data
          })} />}
 <div className="income-tabs">{(draft.kind !== 'job' || draft.job.entryType === 'travel' || step === 3) && <button className="primary">{draft.kind === 'job' ? draft.job.entryType === 'travel' ? "Review Travel Before Saving" : "Review Inspection Before Saving" : "Preview Changes"}</button>}<button type="button" onClick={() => requestNavigation(draft?.isNew ? 'home' : 'list')}>Cancel</button></div></fieldset></form> : <>

 {view === 'income' && <><IncomeList key={period + ':' + scope} book={book} rows={rows} preference={reporting.incomeDisplay?.[scope === 'year' ? book.year + '-all' : period] || {}} onSavePreference={async value => {
            if (!onSaveReporting) throw Error('Display settings are unavailable.');
            setLocalBusy(true);
            try {
              await onSaveReporting({
                ...reporting,
                incomeDisplay: {
                  ...reporting.incomeDisplay,
                  [scope === 'year' ? book.year + '-all' : period]: value
                }
              });
            } finally {
              setLocalBusy(false);
            }
          }} onEdit={editJob} onDirty={setIncomeArranging} busy={locked} /><Guidance title="About These Entries"><p>Customer payments and refunds count in their recorded income month. Bank matching does not add income. Original entries keep their retained month until reviewed.</p></Guidance></>}
 {view === 'inspections' && <><div className="bank-view-summary inspection-view-summary"><div><small>Recorded Travel</small><strong>{travel.reduce((n, r) => n + (r.miles || 0), 0).toLocaleString()} mi</strong><span className="mileage-review-cue">{travel.filter(r => mileageNeedsReview(book, r)).reduce((n, r) => n + (r.miles || 0), 0).toLocaleString()} mi need review · Included in recorded total</span><span>Truck {travel.filter(r => r.vehicle === 'Truck').reduce((n, r) => n + (r.miles || 0), 0).toLocaleString()} mi · Van {travel.filter(r => r.vehicle === 'Van').reduce((n, r) => n + (r.miles || 0), 0).toLocaleString()} mi · Vehicle Not Reviewed {travel.filter(r => !r.vehicle).reduce((n, r) => n + (r.miles || 0), 0).toLocaleString()} mi</span></div></div><Guidance title="About These Inspections"><p>Open an inspection to review its visits, customer payments and bank connections. Mileage follows each visit’s date, even when payment arrives in a different month.</p></Guidance><div className="inspection-list-tools"><label>Find Inspection<input value={query} onChange={e => setQuery(e.target.value)} /></label><label className="income-check"><input type="checkbox" checked={findAll} onChange={e => setFindAll(e.target.checked)} />Find An Existing Inspection Across All Linked Years</label></div>
<div className="inspection-card-list">{jobs.map(r => {
              const j = l.jobs[r.id],
                isTravel = j?.entryType === 'travel',
                visits = j?.visits || [],
                vehicles = [...new Set(visits.map(v => v.vehicle).filter(Boolean))].join(' / '),
                name = jobLabel(book, r.id),
                profile = j?.profile,
                w = jobWorkflow(book, r.id),
                summary = inspectionSummary(j),
                romTarget = [...visits].filter(v => v.outcome === 'Scheduled' || v.romExport).sort((a, b) => (a.outcome === 'Scheduled' ? 0 : 1) - (b.outcome === 'Scheduled' ? 0 : 1) || (a.date || '').localeCompare(b.date || ''))[0],
                tone = ['Completed', 'Travel Reviewed'].includes(summary.status) ? 'good' : summary.status === 'Scheduled' ? 'neutral' : 'amber';
              return <details className={'inspection-detail-card ' + tone} key={r.id}><summary><div className="inspection-card-date"><strong>{summary.firstDate ? readableDate(summary.firstDate) + (summary.lastDate !== summary.firstDate ? ' – ' + readableDate(summary.lastDate) : '') : r.month + ' ' + (r.ownerYear || book.year)}</strong><small>{r.inspectionDate ? `${r.visitCount || 0} Visit${r.visitCount === 1 ? '' : 's'}` : 'Visit Date Not Reviewed'}</small></div><div className="inspection-card-customer"><strong>{profile ? customerNames(profile) || name : name}</strong>{profile && <small>{name.startsWith(customerNames(profile)) ? name.slice(customerNames(profile).length).replace(/^\s*·\s*/, '') : name}</small>}</div><div className="inspection-summary-outcome"><span className={'settlement-status ' + tone}>{summary.status}{summary.completedDate && <> · {readableDate(summary.completedDate)}</>}</span>{allowRom && !isTravel && visits.some(v => v.outcome === 'Scheduled' || v.romExport) && <button type="button" disabled={locked} onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      const v = romTarget;
                      setRomVisit({
                        jobId: r.id,
                        visitId: v.id
                      });
                      setRomOpen(true);
                    }}>{romTarget?.romExport ? 'Update RōM Trip' : 'Plan Travel in RōM'}</button>}{summary.pendingFollowups > 0 && <small className="inspection-pending-followup">{summary.pendingFollowups} Follow-up{summary.pendingFollowups === 1 ? '' : 's'} Pending</small>}</div><span className="inspection-card-travel"><strong>{r.miles ?? 'Unknown'} mi</strong><small>{vehicles || 'Vehicle Not Reviewed'}</small></span><span className="bank-detail-toggle"><span className="when-closed">View Details</span><span className="when-open">Hide Details</span></span></summary>
<div className="inspection-card-body"><WorkflowStatus book={book} id={r.id} onMatch={() => beginMatch(r.id)} /><div className="inspection-financial-strip">{isTravel ? <span>Mileage-Only · No Income Or Bank Connection Required</span> : j ? <><span>Payments <strong>{money(total(l.events.filter(e => e.jobId === r.id && e.type === 'payment')))}</strong></span><span>Refunds <strong>{money(total(l.events.filter(e => e.jobId === r.id && e.type === 'refund')))}</strong></span><span>Net Received <strong>{money(total(l.events.filter(e => e.jobId === r.id && e.type === 'payment')) - total(l.events.filter(e => e.jobId === r.id && e.type === 'refund')))}</strong></span></> : <span>Original Entry <strong>{money(r.amount || 0)}</strong> · Payment Date Not Reviewed</span>}</div><section className="inspection-visit-list"><h3>{isTravel ? 'Travel & Mileage' : 'Visits & Mileage · Whole Job'}</h3>{visits.map(v => <div className="inspection-visit-row" key={v.id}><span>{v.date ? readableDate(v.date) : 'Date Pending'}</span><div><strong>{v.purpose}</strong>{v.destination?.name && <small>{v.destination.name}{v.destination.address ? ' · ' + v.destination.address : ''}</small>}<small>{isTravel ? j.travelReview === 'reviewed' ? 'Reviewed' : 'Needs Research' : v.outcome} · {{
                            courtesy: 'Courtesy / No Charge',
                            included: 'Included In Original Fee',
                            separate: 'Separately Charged',
                            undecided: 'Charge Not Decided'
                          }[v.charge]}</small>{v.note && <p>{v.note}</p>}{allowRom && !isTravel && (v.outcome === 'Scheduled' || v.romExport) && <button type="button" disabled={locked} onClick={() => {
                          setRomVisit({
                            jobId: r.id,
                            visitId: v.id
                          });
                          setRomOpen(true);
                        }}>{v.romExport ? 'Update RōM Trip' : 'Plan Travel in RōM'}</button>}</div><span>{v.vehicle || 'Vehicle Pending'}</span><strong>{v.miles ?? 'Unknown'} mi</strong></div>)}{!visits.length && <p className="hint">Visit details have not been entered.</p>}</section><div className="bank-support-grid"><section><h3>{isTravel ? 'Travel Purpose' : 'Location & Quote'}</h3><p>{isTravel ? j.travelPurpose || 'Not Known Yet · Needs Research' : profile ? locationLabel(profile) : r.location || 'Location Not Recorded'}</p>{profile?.quotedFee != null && <p>Quoted Fee (Not Income): {money(profile.quotedFee)}</p>}</section><section><h3>Notes & History</h3>{j?.reason && <p>{j.reason}</p>}<button onClick={() => showHistory(r.id)}>{history === r.id ? 'Hide History & Notes' : 'View History & Notes'}</button>{history === r.id && <div>{(r.notes || book.notes.filter(n => n.recordId === r.id)).map(n => <p key={n.id}>{n.text}</p>)}{l.events.filter(e => e.jobId === r.id).map(e => <p key={e.id}>{readableDate(e.date)} · {e.type === 'refund' ? 'Refund' : 'Payment'} · {money(e.amount)} · {e.note} · {e.method || ''} {e.reference || ''}{e.type === 'payment' && e.paidBy ? ' · Paid By: ' + e.paidBy : ''}</p>)}{l.payouts.filter(p => p.items.some(x => settledEvents.find(e => e.id === x.eventId)?.jobId === r.id)).map(p => <p key={p.id}>Bank · {readableDate(p.date)} · {money(p.amount)} · {payoutStatus(book, p).label}</p>)}</div>}</section></div><div className="bank-settlement-actions inspection-card-actions"><button onClick={() => editJob(r.id)}>{isTravel ? 'Edit Travel Details' : j ? 'Edit Inspection & Payments' : 'Review / Convert Inspection'}</button>{!isTravel && !r.amount && !l.events.some(e => e.jobId === r.id) && <button onClick={() => editJob(r.id, 'travel')}>Review As Mileage-Only Travel</button>}{book.records.some(x => x.id === r.id) && <button type="button" disabled={locked} onClick={() => beginMove(r.id)}>Move to Month</button>}{onRemoveOriginal && canRemoveOriginal(book, r.id) && <details className="inspection-more-actions"><summary>More Actions</summary><button type="button" className="danger" disabled={locked} onClick={() => onRemoveOriginal(book.records.find(x => x.id === r.id))}>Remove Original Entry</button></details>}{j && !isTravel && <><button onClick={() => editJob(r.id, 'visit')}>Add Visit</button><button onClick={() => editJob(r.id, 'payment')}>Record Payment</button><button onClick={() => editJob(r.id, 'refund')}>Record Refund</button></>}</div></div></details>;
            })}{!jobs.length && <p className="small-empty">No inspections match this view.</p>}</div></>}
 {view === 'bank' && <><div className="bank-view-summary"><div><small>Entered Bank Transactions</small><strong>{money(total(l.payouts.filter(p => fits(p.date))))}</strong><span>{periodPayouts.length} transaction{periodPayouts.length === 1 ? '' : 's'} · {confirmed.length} confirmed · {needsAttention.length} to review</span></div></div><Guidance title="About This Total"><p>Only entered bank transactions are included. This is not your account balance or proof that every processor payout has been entered.</p></Guidance>
<div className="bank-settlement-list">{l.payouts.filter(p => fits(p.date)).slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map(p => {
              const status = payoutStatus(book, p),
                tone = status.label === 'Confirmed' ? 'good' : status.label === 'Suggested' ? 'amber' : 'red';
              return <details className={'bank-settlement-card ' + tone} key={p.id}><summary><div className="bank-date"><strong>{readableDate(p.date)}</strong><small>{Number(p.amount) < 0 ? 'Bank Withdrawal' : 'Bank Deposit'} · {p.items.length} linked entr{p.items.length === 1 ? 'y' : 'ies'}</small></div><strong className="bank-amount">{money(p.amount)}</strong><span className={'bank-balance ' + (status.difference === 0 ? 'balanced' : 'unbalanced')}>{status.difference === 0 ? 'Balanced · $0.00 Difference' : `Difference ${money(status.difference)}`}</span><span className={'settlement-status ' + tone}>{status.label}</span><span className="bank-detail-toggle"><span className="when-closed">View Details</span><span className="when-open">Hide Details</span></span></summary>
<div className="bank-settlement-body">{status.issues.map((issue, i) => <p role="alert" className="workflow-warning" key={i}>{issue}</p>)}<section className="bank-linked-payments"><div className="bank-subheading"><h3>Payments & Refunds In This Transaction</h3><span>Selected Total <strong>{money(status.selected)}</strong></span></div>{p.items.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).map(x => {
                      const e = settledEvents.find(e => e.id === x.eventId),
                        profile = e && l.jobs[e.jobId]?.profile,
                        name = e ? jobLabel(book, e.jobId) : 'Missing Event';
                      return <div className="bank-payment-row" key={x.eventId}><span className="bank-payment-date">{x.date ? readableDate(x.date) : 'Payment Date Not Reviewed'}</span><div><strong>{profile ? customerNames(profile) || name : name}</strong>{profile && <small>{name.startsWith(customerNames(profile)) ? name.slice(customerNames(profile).length).replace(/^\s*·\s*/, '') : name}</small>}</div><span className={'bank-event-type ' + (x.amount < 0 ? 'refund' : '')}>{x.amount < 0 ? 'Refund' : 'Payment'}</span><strong className={'bank-event-amount ' + (x.amount < 0 ? 'refund' : '')}>{x.amount < 0 ? '−' : '+'}{money(Math.abs(x.amount))}</strong></div>;
                    })}{!p.items.length && <p className="hint">No customer payments or refunds connected yet.</p>}</section>
<div className="bank-support-grid"><section><h3>Source & Verification</h3><p>{statementLabel(p)}</p><div className="bank-evidence-tags">{(p.evidence || []).map(id => <span key={id}>{evidenceTypes.find(x => x[0] === id)?.[1] || id}</span>)}</div>{!p.evidence?.length && <p className="hint">Evidence not recorded for this earlier entry.</p>}{p.otherEvidence && <p>{p.otherEvidence}</p>}<small>{p.confirmedAt ? 'Last Confirmation: ' + new Date(p.confirmedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short'
                        }) : 'Confirmation date not recorded'}</small></section><section><h3>Reference & Notes</h3><dl><dt>Reference</dt><dd>{p.reference || 'No reference added'}</dd><dt>Settlement Notes</dt><dd>{p.note || 'No notes added'}</dd></dl></section></div><div className="bank-settlement-actions"><button onClick={() => editPayout(p)}>Edit Settlement</button><button className="bank-remove-action" disabled={locked} onClick={() => {
                      const b = structuredClone(book);
                      b.inspectionLedger.payouts = b.inspectionLedger.payouts.filter(x => x.id !== p.id);
                      setPreview(b);
                    }}>Remove Settlement</button></div></div></details>;
            })}{!periodPayouts.length && <p className="small-empty">No bank transactions entered for this period.</p>}</div></>}

 </>}
 </div></section>;
}
