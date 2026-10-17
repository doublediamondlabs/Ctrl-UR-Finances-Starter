import React, { useState, useEffect, useRef } from 'react';
import { MONTHS, moneyTotal, newTransaction, stageIncome, parsePasted, addTransactions, reorder, copyMonthEntries, moveHouseholdEntries } from './household.js';
const cash = n => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(n);
const blank = () => ({
  description: '',
  amount: '',
  note: '',
  householdSubId: '',
  transactionDate: ''
});
function Modal({
  title,
  onClose,
  busy,
  children
}) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return <dialog ref={ref} className="household-dialog" onCancel={e => {
    e.preventDefault();
    if (!busy) onClose();
  }}><div className="modal-head"><h2>{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close household dialog">×</button></div><fieldset disabled={busy}>{children}</fieldset></dialog>;
}
export default function HouseholdWorkspace({
  book,
  month,
  income = false,
  onSave,
  onEdit,
  onNotes,
  busy,
  search = '',
  onDirty,
  initiallyExpanded = false,
  renderLoanCue = () => null
}) {
  const field = income ? 'incomeSources' : 'householdCategories',
    defs = book[field] || [],
    period = MONTHS[month],
    title = income ? 'Personal income' : 'Housing (private) · Expenses';
  const categoryRoot = useRef(null);
  const [open, setOpen] = useState(initiallyExpanded),
    [expanded, setExpanded] = useState([]),
    [modal, setModal] = useState(null),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(null);
  const rows = book.records.filter(e => income ? e.kind === 'income' : e.scope === 'residence'),
    current = rows.filter(e => e.month === period);
  useEffect(() => {
    setExpanded([]);
    setModal(null);
    setError('');
  }, [month, book.year]);
  useEffect(() => {
    onDirty?.(!!modal);
    return () => onDirty?.(false);
  }, [!!modal]);
  function close() {
    if (modal?.dirty && !confirm('Discard these unsaved changes?')) return;
    setModal(null);
    setError('');
  }
  function update(value) {
    setModal(m => ({
      ...m,
      ...value,
      dirty: true
    }));
    setError('');
  }
  async function commit(next, done = () => setModal(null)) {
    setError('');
    try {
      const ok = await onSave(next);
      if (ok) done();else setError("Not saved. Your edits remain here. Close Excel and retry. The workspace also shows the save error.");
    } catch (e) {
      setError(e.message);
    }
  }
  function startCategory(def = null) {
    setError('');
    setModal({
      type: 'category',
      id: def?.id || null,
      name: def?.name || '',
      availableMonths: def ? [...def.months] : [...MONTHS],
      subs: def?.subs.map(s => ({
        ...s
      })) || [],
      dirty: false
    });
  }
  function startRows(def, old = null) {
    setError('');
    setModal({
      type: 'rows',
      categoryId: def.id,
      replaceId: old?.id || null,
      oldAmount: old?.amount,
      rows: [blank()],
      paste: old ? book.notes.filter(n => n.recordId === old.id).map(n => n.text).join('\n') : '',
      dirty: false
    });
  }
  function startClassify(def, entry = null) {
    setError('');
    setModal({
      type: 'classify',
      sourceId: def.id,
      targetId: entry ? '' : def.id,
      subId: '',
      all: false,
      selected: entry ? [entry.id] : [],
      dirty: false
    });
  }
  async function saveCategory(e) {
    e.preventDefault();
    const name = modal.name.trim();
    if (!name) return;
    if (!modal.availableMonths.length) {
      setError('Select at least one month.');
      return;
    }
    const subNames = modal.subs.map(s => s.name.trim());
    if (defs.some(c => c.id !== modal.id && c.name.toLowerCase() === name.toLowerCase())) {
      setError('That name already exists.');
      return;
    }
    if (subNames.some(n => !n) || new Set(subNames.map(n => n.toLowerCase())).size !== subNames.length) {
      setError('Give each subcategory a unique, nonblank name.');
      return;
    }
    const next = structuredClone(book),
      old = next[field].find(c => c.id === modal.id),
      def = {
        ...old,
        id: modal.id || crypto.randomUUID(),
        name,
        months: MONTHS.filter(m => modal.availableMonths.includes(m)),
        subs: modal.subs.map(s => ({
          ...s,
          name: s.name.trim()
        }))
      };
    if (old) {
      const outside = rows.some(r => r.householdCategoryId === old.id && !def.months.includes(r.month));
      if (outside) {
        setError('This category has entries in other months. Keep it available in those months or reassign those entries first.');
        return;
      }
      next[field] = next[field].map(c => c.id === old.id ? def : c);
      next.records.filter(r => r.householdCategoryId === def.id).forEach(r => {
        if (!income) r.subCategory = name;
      });
    } else next[field].push(def);
    await commit(next);
  }
  async function removeCategory(def) {
    const used = rows.filter(e => e.householdCategoryId === def.id);
    if (used.length) {
      setError('“' + def.name + '” has ' + used.length + ' entries across the year. Use Move Entries to move them to another category, or remove the individual entries first.');
      return;
    }
    if (!confirm('Remove empty category “' + def.name + '” from this workbook?')) return;
    await commit({
      ...book,
      [field]: defs.filter(c => c.id !== def.id)
    }, () => {});
  }
  async function move(id, target) {
    if (id === target) return;
    await commit({
      ...book,
      [field]: reorder(defs, id, target)
    }, () => {});
  }
  async function saveRows(e) {
    e.preventDefault();
    try {
      const next = addTransactions(book, {
        categoryId: modal.categoryId,
        month: period,
        income,
        rows: modal.rows,
        replaceId: modal.replaceId
      });
      await commit(next);
    } catch (err) {
      setError(err.message);
    }
  }
  async function classify(e) {
    e.preventDefault();
    try {
      await commit(moveHouseholdEntries(book, {
        income,
        entryIds: modal.selected,
        targetId: modal.targetId,
        subId: modal.subId
      }));
    } catch (err) {
      setError(err.message);
    }
  }
  const surplus = Math.round((moneyTotal(book.records.filter(e => e.month === period && e.kind === 'income' && e.state === 'recorded')) - moneyTotal(current.filter(e => e.state === 'recorded'))) * 100) / 100;
  const flowClass = amount => (income ? Number(amount) >= 0 : Number(amount) < 0) ? 'balance-positive' : 'balance-negative';
  const available = defs.filter(c => c.months.includes(period) || current.some(e => e.householdCategoryId === c.id));
  function jump(id) {
    if (!id) return;
    setExpanded(ids => ids.includes(id) ? ids : [...ids, id]);
    requestAnimationFrame(() => {
      const el = [...categoryRoot.current.querySelectorAll('[data-category-id]')].find(e => e.dataset.categoryId === id);
      el?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start'
      });
      el?.querySelector('.household-category-toggle')?.focus({
        preventScroll: true
      });
    });
  }
  const matches = e => [e.description, e.subCategory, ...book.notes.filter(n => n.recordId === e.id).map(n => n.text)].join(' ').toLowerCase().includes(search.toLowerCase());
  const selectedDef = modal && defs.find(c => c.id === (modal.categoryId || modal.sourceId));
  return <section className={'expense-group household-workspace ' + (income ? 'personal-income-group' : 'housing-group')} aria-label={title}>
 <div className="household-heading"><button className="housing-disclosure" aria-expanded={open} onClick={() => setOpen(!open)}><span aria-hidden="true">{open ? "▾" : "▸"}</span><div><h3>{title}</h3><small>{period} {book.year} · {income ? "Receipts Kept Separate From Business Sales" : "Monthly Entries, Shared Categories"}</small></div></button><button onClick={() => startCategory()}>+ {income ? "Income Source" : "Category"}</button></div>
 <div className="housing-totals"><span>{period} recorded<strong>{cash(moneyTotal(current.filter(e => e.state === 'recorded')))}</strong></span><span>Planned<strong>{cash(moneyTotal(current.filter(e => e.state === 'planned')))}</strong></span>{!income && <span className="household-balance">{surplus < 0 ? 'Deficit' : surplus > 0 ? 'Surplus' : 'Balanced'}<strong data-metric="household-surplus" className={surplus < 0 ? 'balance-negative' : surplus > 0 ? 'balance-positive' : 'balance-neutral'}>{surplus > 0 ? '+' : ''}{cash(surplus)}</strong><small>Personal income minus household expenses</small></span>}</div>
 {error && !modal && <p className="error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></p>}
 {(open || search) && <div className="household-categories" ref={categoryRoot}><div className="category-jump-bar"><label>Jump to category<select aria-label={income ? 'Jump to income source' : 'Jump to expense category'} value="" onChange={e => jump(e.target.value)}><option value="">Choose a category…</option>{available.map(c => <option key={c.id} value={c.id}>{c.name} · {cash(moneyTotal(current.filter(r => r.householdCategoryId === c.id && r.state === 'recorded')))}</option>)}</select></label><button type="button" onClick={() => setExpanded([])}>Collapse All</button></div><p className="housing-hint">{income ? 'Set recurring income once, then record the actual receipt in each month.' : 'Enter payments as positive amounts and refunds as negative amounts. Category totals calculate from the entries below.'} Drag a category handle to reorder, or use ↑ / ↓.</p>
 {defs.filter(c => c.months.includes(period) || current.some(e => e.householdCategoryId === c.id)).map(def => {
        const entries = current.filter(e => e.householdCategoryId === def.id),
          shown = entries.filter(matches),
          isOpen = expanded.includes(def.id) || !!search && shown.length > 0,
          index = defs.findIndex(c => c.id === def.id);
        return <section className="household-category" key={def.id} data-household-category={def.name} data-category-id={def.id} onDragOver={e => e.preventDefault()} onDrop={e => {
          e.preventDefault();
          if (drag) move(drag, def.id);
          setDrag(null);
        }}>
 <div className="household-category-heading"><span className="drag-handle" draggable onDragStart={e => {
              setDrag(def.id);
              e.dataTransfer.setData('text/plain', def.id);
            }} onDragEnd={() => setDrag(null)} title="Drag to reorder" aria-label={'Drag ' + def.name}>⠿</span><button className="household-category-toggle" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? expanded.filter(id => id !== def.id) : [...expanded, def.id])}><span>{isOpen ? "▾" : "▸"} {def.name}<small>{entries.length} {entries.length === 1 ? "Entry" : "Entries"} · {period}</small></span><span><strong>{cash(moneyTotal(entries.filter(e => e.state === 'recorded')))}</strong>{entries.some(e => e.state === 'planned') && <small>{cash(moneyTotal(entries.filter(e => e.state === 'planned')))} planned</small>}</span></button><div className="order-buttons"><button aria-label={'Move ' + def.name + ' up'} disabled={index === 0 || busy} onClick={() => move(def.id, defs[index - 1].id)}>↑</button><button aria-label={'Move ' + def.name + ' down'} disabled={index === defs.length - 1 || busy} onClick={() => move(def.id, defs[index + 1].id)}>↓</button></div></div>
 {isOpen && <div className="household-category-body"><div className="household-actions"><button onClick={() => startRows(def)}>+ {income ? "Receipt" : "Purchases"}</button><button onClick={() => startCategory(def)}>Edit Category</button><button onClick={() => {
                const previous = MONTHS.slice(0, month).reverse().find(m => rows.some(r => r.month === m && r.householdCategoryId === def.id)) || period;
                setModal({
                  type: 'copy',
                  categoryId: def.id,
                  sourceMonth: previous,
                  targetMonths: previous === period ? [] : [period],
                  entryIds: rows.filter(r => r.month === previous && r.householdCategoryId === def.id).map(r => r.id),
                  keepAmounts: false,
                  copyNotes: false,
                  dirty: false
                });
              }}>Copy Month Entries</button><button onClick={() => startClassify(def)}>{income ? 'Move Receipts' : 'Move Purchases'}</button>{income && <button onClick={() => setModal({
                type: 'recurring',
                categoryId: def.id,
                start: period,
                amount: '',
                dirty: false
              })}>Set Recurring Income</button>}<button onClick={() => removeCategory(def)}>Remove Category</button></div>
 {def.subs.length > 0 && <div className="subcategory-totals">{[{
                id: '',
                name: 'Unassigned'
              }, ...def.subs].map(sub => <span key={sub.id}>{sub.name} <strong>{cash(moneyTotal(entries.filter(e => (e.householdSubId || '') === sub.id && e.state === 'recorded')))}</strong></span>)}</div>}{shown.length ? shown.map(e => <article className="household-entry" key={e.id}><div className="entry-line"><div><strong>{e.description}</strong><small>{[e.transactionDate, def.subs.find(s => s.id === e.householdSubId)?.name].filter(Boolean).join(' · ')}</small></div><strong className={e.amount === null ? '' : flowClass(e.amount)}>{e.amount === null ? 'Not entered' : cash(e.amount)}</strong></div><div className="entry-bottom"><span className={'badge ' + e.state}>{e.state === 'recorded' ? 'Recorded' : 'Planned'}</span><div className="entry-actions">{renderLoanCue(e)}{onNotes(e)}<button onClick={() => onEdit(e)}>Edit</button><button onClick={() => startClassify(def, e)}>Move</button>{e.state === 'planned' && <button onClick={() => onEdit({
                    ...e,
                    state: 'recorded'
                  })}>Record {period}</button>}<button onClick={() => startRows(def, e)}>Split Into Details</button><button onClick={() => {
                    if (confirm('Remove ' + e.description + ' from ' + e.month + ' ' + book.year + '? Its attached notes will also be removed.')) commit({
                      ...book,
                      records: book.records.filter(r => r.id !== e.id),
                      notes: book.notes.filter(n => n.recordId !== e.id)
                    }, () => {});
                  }}>Remove</button></div></div></article>) : <p className="small-empty">{search ? 'No matching entries.' : 'No entries for ' + period + '.'}</p>}
 </div>}</section>;
      })}</div>}
 {modal && <Modal title={modal.type === 'category' ? modal.id ? 'Edit category' : 'Add ' + (income ? 'income source' : 'category') : modal.type === 'copy' ? 'Copy month entries' : modal.type === 'classify' ? 'Move entries to another category' : modal.type === 'recurring' ? 'Plan recurring income' : modal.replaceId ? 'Replace total with purchase details' : 'Add ' + (income ? 'receipts' : 'purchases')} onClose={close} busy={busy}>
 <p><strong>{modal.type === 'category' ? book.year : period + ' ' + book.year}</strong>{selectedDef ? ' · ' + selectedDef.name : ''}</p>{error && <p className="error" role="alert">{error}</p>}
 {modal.type === 'category' && <form onSubmit={saveCategory}><label>Category name<input required autoFocus value={modal.name} onChange={e => update({
            name: e.target.value
          })} /></label><fieldset className="month-picker"><legend>Available in</legend><button type="button" onClick={() => update({
            availableMonths: [...MONTHS]
          })}>Every Month</button><button type="button" onClick={() => update({
            availableMonths: [period]
          })}>Current Month Only</button><button type="button" onClick={() => update({
            availableMonths: []
          })}>Clear Months</button><div>{MONTHS.map(m => <label key={m}><input type="checkbox" checked={modal.availableMonths.includes(m)} onChange={e => update({
                availableMonths: e.target.checked ? [...modal.availableMonths, m] : modal.availableMonths.filter(x => x !== m)
              })} />{m}</label>)}</div></fieldset><p className="hint">This shares the category name. It does not copy or change any monthly amounts.</p><h3>Subcategories</h3>{modal.subs.map((s, i) => <div className="sub-edit-row" key={s.id}><input aria-label={'Subcategory ' + (i + 1)} required value={s.name} onChange={e => update({
            subs: modal.subs.map(x => x.id === s.id ? {
              ...x,
              name: e.target.value
            } : x)
          })} /><button type="button" disabled={rows.some(r => r.householdSubId === s.id)} onClick={() => update({
            subs: modal.subs.filter(x => x.id !== s.id)
          })}>Remove</button></div>)}<button type="button" onClick={() => update({
          subs: [...modal.subs, {
            id: crypto.randomUUID(),
            name: ''
          }]
        })}>+ Subcategory</button><p className="hint">New subcategories are available in earlier months. Reclassify existing purchases to assign them. A subcategory in use must be reassigned before removal.</p><div className="modal-actions"><button className="primary">Save Category</button></div></form>}
 {modal.type === 'rows' && <form onSubmit={saveRows}>
 {modal.replaceId && <div className="notice">Original total: <strong>{cash(modal.oldAmount || 0)}</strong>. These rows replace that entry. They must add up to the same amount. Existing notes stay with the first row.</div>}
 <details className="paste-purchases" open={modal.replaceId ? true : undefined}><summary>Paste multiple descriptions and amounts</summary><p>One purchase per line: description, then a tab or spaces, then the amount. Review the resulting rows before saving.</p><textarea aria-label="Paste purchases" rows="5" placeholder={'GROCERY STORE\t42.15\nONLINE SHOP\t19.95'} value={modal.paste} onChange={e => update({
            paste: e.target.value
          })} /><button type="button" onClick={() => {
            try {
              const parsed = parsePasted(modal.paste);
              update({
                rows: [...modal.rows.filter(r => r.description || r.amount !== ''), ...parsed],
                paste: ''
              });
            } catch (e) {
              setError(e.message);
            }
          }}>Create Review Rows</button></details>
 <div className="purchase-rows">{modal.rows.map((r, i) => <div className="purchase-row" key={i}><div className="purchase-main"><label>Statement description<input required value={r.description} onChange={e => update({
                  rows: modal.rows.map((x, j) => j === i ? {
                    ...x,
                    description: e.target.value
                  } : x)
                })} /></label><label>Amount ($)<input required type="number" step="0.01" value={r.amount} onChange={e => update({
                  rows: modal.rows.map((x, j) => j === i ? {
                    ...x,
                    amount: e.target.value
                  } : x)
                })} /></label><button type="button" aria-label={'Remove row ' + (i + 1)} onClick={() => update({
                rows: modal.rows.filter((_, j) => j !== i)
              })}>×</button></div><details><summary>Date, subcategory and note</summary><div className="form-grid"><label>Date (optional)<input type="date" value={r.transactionDate} onChange={e => update({
                    rows: modal.rows.map((x, j) => j === i ? {
                      ...x,
                      transactionDate: e.target.value
                    } : x)
                  })} /></label><label>Subcategory<select value={r.householdSubId} onChange={e => update({
                    rows: modal.rows.map((x, j) => j === i ? {
                      ...x,
                      householdSubId: e.target.value
                    } : x)
                  })}><option value="">Unassigned</option>{selectedDef.subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><label>Note<textarea rows="2" value={r.note} onChange={e => update({
                  rows: modal.rows.map((x, j) => j === i ? {
                    ...x,
                    note: e.target.value
                  } : x)
                })} /></label></details></div>)}</div><button type="button" onClick={() => update({
          rows: [...modal.rows, blank()]
        })}>+ Add Row</button><div className="purchase-total">{modal.rows.length} rows · Total <strong>{cash(moneyTotal(modal.rows))}</strong>{modal.replaceId && <span>Difference: {cash(moneyTotal(modal.rows) - Number(modal.oldAmount || 0))}</span>}</div><div className="modal-actions"><button className="primary" disabled={!modal.rows.length}>{modal.replaceId ? "Replace Entry With Details" : "Save Entries To Workbook"}</button></div></form>}
 {modal.type === 'copy' && <form onSubmit={e => {
        e.preventDefault();
        try {
          commit(copyMonthEntries(book, {
            ...modal,
            income
          }));
        } catch (err) {
          setError(err.message);
        }
      }}><label>Copy from month<select value={modal.sourceMonth} onChange={e => update({
            sourceMonth: e.target.value,
            targetMonths: modal.targetMonths.filter(m => m !== e.target.value),
            entryIds: rows.filter(r => r.month === e.target.value && r.householdCategoryId === modal.categoryId).map(r => r.id)
          })}>{MONTHS.map(m => <option key={m}>{m}</option>)}</select></label><p>Select the entries to copy:</p>{rows.filter(r => r.month === modal.sourceMonth && r.householdCategoryId === modal.categoryId).map(r => <label className="check" key={r.id}><input type="checkbox" checked={modal.entryIds.includes(r.id)} onChange={e => update({
            entryIds: e.target.checked ? [...modal.entryIds, r.id] : modal.entryIds.filter(id => id !== r.id)
          })} />{r.description} · {r.amount === null ? 'Not entered' : cash(r.amount)} · {r.state}</label>)}<fieldset className="month-picker"><legend>Copy to months</legend><div>{MONTHS.filter(m => m !== modal.sourceMonth).map(m => <label key={m}><input type="checkbox" checked={modal.targetMonths.includes(m)} onChange={e => update({
                targetMonths: e.target.checked ? [...modal.targetMonths, m] : modal.targetMonths.filter(x => x !== m)
              })} />{m}</label>)}</div></fieldset><label className="check"><input type="checkbox" checked={modal.keepAmounts} onChange={e => update({
            keepAmounts: e.target.checked
          })} />Keep amounts as planned estimates</label><label className="check"><input type="checkbox" checked={modal.copyNotes} onChange={e => update({
            copyNotes: e.target.checked
          })} />Copy notes too</label><p className="notice">Creates {modal.entryIds.length * modal.targetMonths.length} new planned entries. Descriptions and assigned subcategories are kept; dates are cleared. Amounts are blank unless you choose estimates. Existing entries are never overwritten; matching destination entries block the copy. Record each new entry after checking that month's statement.</p><button className="primary" disabled={!modal.entryIds.length || !modal.targetMonths.length}>Copy Entries To Selected Months</button></form>}
 {modal.type === 'recurring' && <form onSubmit={e => {
        e.preventDefault();
        try {
          const amount = modal.amount === '' ? null : Number(modal.amount);
          if (amount !== null && !Number.isFinite(amount)) throw Error('Enter a valid amount.');
          commit(stageIncome(book, modal.categoryId, modal.start, amount));
        } catch (err) {
          setError(err.message);
        }
      }}><label>Starting month<select value={modal.start} onChange={e => update({
            start: e.target.value
          })}>{MONTHS.map(m => <option key={m}>{m}</option>)}</select></label><label>Expected monthly amount ($)<input type="number" step="0.01" value={modal.amount} onChange={e => update({
            amount: e.target.value
          })} placeholder="Leave blank if unknown" /></label><p className="notice">Creates or updates planned receipts from the starting month through December. Recorded receipts remain unchanged. For a cost-of-living change, select its effective month. Use Record in each month to enter the actual receipt.</p><button className="primary">Save Planned Receipts</button></form>}
 {modal.type === 'classify' && <form onSubmit={classify}><label>Show months<select value={modal.all ? 'all' : 'current'} onChange={e => update({
            all: e.target.value === 'all',
            selected: []
          })}><option value="current">{period} only</option><option value="all">All months in {book.year}</option></select></label><div className="form-grid"><label>Destination category<select value={modal.targetId} onChange={e => update({
              targetId: e.target.value,
              subId: ''
            })}><option value="">Choose destination</option>{defs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Destination subcategory<select value={modal.subId} onChange={e => update({
              subId: e.target.value
            })}><option value="">Unassigned</option>{defs.find(c => c.id === modal.targetId)?.subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><p className="hint">Select one or multiple entries, choose the destination, then Move & Save. Existing entries are moved; no duplicate purchases are created. Amounts, dates, months, notes and bank links are preserved. Refresh the Move & Housing Planner afterward to use the revised categories.</p><button type="button" onClick={() => update({
          selected: rows.filter(e => e.householdCategoryId === modal.sourceId && (modal.all || e.month === period)).map(e => e.id)
        })}>Select All Shown</button><button type="button" onClick={() => update({
          selected: []
        })}>Clear Selection</button><div className="classify-list">{rows.filter(e => e.householdCategoryId === modal.sourceId && (modal.all || e.month === period)).map(e => <label className="check" key={e.id}><input type="checkbox" checked={modal.selected.includes(e.id)} onChange={ev => update({
              selected: ev.target.checked ? [...modal.selected, e.id] : modal.selected.filter(id => id !== e.id)
            })} /><span>{e.month} · {e.description} · {e.state} · {e.amount === null ? 'Not entered' : cash(e.amount)}</span></label>)}</div><button className="primary" disabled={!modal.selected.length}>Move {modal.selected.length} {modal.selected.length === 1 ? 'Entry' : 'Entries'} &amp; Save</button></form>}
 </Modal>}
 </section>;
}
