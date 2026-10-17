import React, { useState, useEffect } from "react";
import { cash, when, localDate, Cue } from "./Overview.jsx";
import { debtSummary, estimate, editableLoan, breakdownMessage, linkedPayment } from "./debts.js";
import { months, writeBook } from "./workbook.js";
function DebtCards({
  loans,
  books,
  onOpen
}) {
  return loans.filter(l => !l.archived).map(l => {
    const s = debtSummary(l, books, localDate());
    return /* @__PURE__ */React.createElement("article", {
      className: "overview-card",
      key: l.id
    }, /* @__PURE__ */React.createElement("h2", null, l.name), /* @__PURE__ */React.createElement(Cue, {
      state: s.state
    }, s.label), /* @__PURE__ */React.createElement("dl", null, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("dt", null, "Confirmed principal"), /* @__PURE__ */React.createElement("dd", null, cash(l.balance))), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("dt", null, "Principal as of"), /* @__PURE__ */React.createElement("dd", null, when(l.asOf))), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("dt", null, "Tracked principal", s.uncertain ? " (incomplete)" : ""), /* @__PURE__ */React.createElement("dd", null, cash(s.balance))), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("dt", null, "Scheduled principal + interest"), /* @__PURE__ */React.createElement("dd", null, cash(l.payment))), l.payoffQuote != null && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("dt", null, "Lender payoff quote"), /* @__PURE__ */React.createElement("dd", null, cash(l.payoffQuote))), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("dt", null, "Quote as of"), /* @__PURE__ */React.createElement("dd", null, when(l.payoffQuoteDate))))), /* @__PURE__ */React.createElement("p", null, l.paidOff ? "Paid off " + when(l.paidOff) : "Next due (maintained manually): " + when(l.nextDue)), l.original > 0 && s.balance >= 0 && s.balance <= l.original && /* @__PURE__ */React.createElement("label", null, "Principal repaid \xB7 ", Math.round((1 - s.balance / l.original) * 100), "%", s.uncertain ? " (incomplete)" : "", /* @__PURE__ */React.createElement("progress", {
      max: l.original,
      value: l.original - s.balance
    })), /* @__PURE__ */React.createElement("button", {
      onClick: () => onOpen("debt_" + l.id)
    }, "Open ", l.name));
  });
}
const blank = () => ({
  id: crypto.randomUUID().replaceAll("-", ""),
  name: "",
  lender: "",
  area: "personal",
  mode: "current",
  original: 0,
  balance: 0,
  asOf: localDate(),
  rate: 0,
  term: 60,
  payment: 0,
  plannedExtraPrincipal: 0,
  dueDay: 16,
  nextDue: localDate(),
  note: "",
  paidOff: "",
  archived: false,
  links: [],
  originationDate: "",
  originalTerm: null,
  maturityDate: "",
  payoffQuote: null,
  payoffQuoteDate: ""
});
function ExpensePicker({
  entries,
  loans,
  link,
  onSelect,
  initialYear,
  initialMonth,
  editing
}) {
  const [year, setYear] = useState(String(initialYear)),
    [month, setMonth] = useState(String(initialMonth)),
    [query, setQuery] = useState(""),
    [planned, setPlanned] = useState(false),
    [showLinked, setShowLinked] = useState(false),
    [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [year, month, query, planned, showLinked]);
  const owners = new Map(loans.flatMap(l => l.links.map(p => [p.year + ":" + p.recordId, l]))),
    selected = entries.find(r => r.id === link.recordId && r.year === link.year);
  const category = r => [r.category, r.subCategory].filter(Boolean).join(" / ");
  const results = entries.filter(r => {
    if (year !== "all" && r.year !== Number(year) || month !== "all" && months.indexOf(r.month) !== Number(month) || !planned && r.state !== "recorded" || !showLinked && owners.has(r.year + ":" + r.id)) return false;
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),
      text = [r.description, category(r), r.year, r.month, r.transactionDate, r.amount == null ? "" : r.amount.toFixed(2), r.amount == null ? "" : cash(r.amount)].join(" ").toLocaleLowerCase();
    return words.every(word => text.includes(word) || /^[\d$,.]+$/.test(word) && r.amount != null && r.amount.toFixed(2).includes(word.replace(/[$,]/g, "")));
  }).sort((a, b) => b.year - a.year || months.indexOf(b.month) - months.indexOf(a.month) || (b.transactionDate || "").localeCompare(a.transactionDate || "") || (a.description || "").localeCompare(b.description || "") || a.id.localeCompare(b.id));
  return /* @__PURE__ */React.createElement("section", {
    className: "expense-picker",
    "aria-label": "Choose an expense"
  }, !editing && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("h4", null, "Find an expense"), /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Filter year", /* @__PURE__ */React.createElement("select", {
    value: year,
    onChange: e => setYear(e.target.value)
  }, /* @__PURE__ */React.createElement("option", {
    value: "all"
  }, "All years"), [... /* @__PURE__ */new Set([Number(initialYear), ...entries.map(r => r.year)])].sort((a, b) => b - a).map(y => /* @__PURE__ */React.createElement("option", {
    key: y
  }, y)))), /* @__PURE__ */React.createElement("label", null, "Filter month", /* @__PURE__ */React.createElement("select", {
    value: month,
    onChange: e => setMonth(e.target.value)
  }, /* @__PURE__ */React.createElement("option", {
    value: "all"
  }, "All months"), months.map((m, i) => /* @__PURE__ */React.createElement("option", {
    key: m,
    value: i
  }, m))))), /* @__PURE__ */React.createElement("label", null, "Search expenses", /* @__PURE__ */React.createElement("input", {
    type: "search",
    placeholder: "Description, category or amount \u2014 e.g. Van or 2000",
    value: query,
    onChange: e => setQuery(e.target.value)
  })), /* @__PURE__ */React.createElement("div", {
    className: "picker-options"
  }, /* @__PURE__ */React.createElement("label", null, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked: planned,
    onChange: e => setPlanned(e.target.checked)
  }), "Include planned"), /* @__PURE__ */React.createElement("label", null, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked: showLinked,
    onChange: e => setShowLinked(e.target.checked)
  }), "Show linked"), /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => {
      setYear("all");
      setMonth("all");
      setQuery("");
    }
  }, "Clear Search & Show All Months/Years")), /* @__PURE__ */React.createElement("p", {
    "aria-live": "polite"
  }, results.length, " matching expenses \xB7 recorded", planned ? " and planned" : "", showLinked ? " \xB7 linked entries shown for reference" : ""), /* @__PURE__ */React.createElement("div", {
    className: "expense-picker-results"
  }, results.slice(0, limit).map(r => {
    const owner = owners.get(r.year + ":" + r.id),
      chosen = r.id === link.recordId && r.year === link.year;
    return /* @__PURE__ */React.createElement("div", {
      className: "expense-picker-row " + (chosen ? "chosen" : ""),
      key: r.year + ":" + r.id
    }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, r.description || "Untitled expense"), /* @__PURE__ */React.createElement("small", null, category(r)), /* @__PURE__ */React.createElement("small", null, r.month, " ", r.year, r.transactionDate ? " \xB7 " + when(r.transactionDate) : " \xB7 payment date not entered", " \xB7 ", r.state === "recorded" ? "Recorded" : "Planned"), owner && /* @__PURE__ */React.createElement("small", null, "Linked to ", owner.name, owner.archived ? " (archived)" : "")), /* @__PURE__ */React.createElement("strong", null, r.amount == null ? "No amount" : cash(r.amount)), /* @__PURE__ */React.createElement("button", {
      type: "button",
      disabled: !!owner || chosen,
      onClick: () => onSelect(r),
      "aria-label": "Select " + (r.description || "expense") + " \xB7 " + r.month + " " + r.year + " \xB7 " + (r.amount == null ? "No amount" : cash(r.amount))
    }, owner ? "Already Linked" : chosen ? "Selected" : "Select"));
  }), !results.length && /* @__PURE__ */React.createElement("p", null, "No matching expenses. Try All months / All years, clear the search, or include planned / linked entries. Only this loan\u2019s Business or Personal area is shown.")), results.length > limit && /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => setLimit(limit + 50)
  }, "Show 50 More")), /* @__PURE__ */React.createElement("div", {
    className: "notice selected-expense",
    "aria-live": "polite"
  }, /* @__PURE__ */React.createElement("strong", null, "Selected expense"), selected ? /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, selected.description || "Untitled expense", " \xB7 ", selected.amount == null ? "No amount" : cash(selected.amount)), /* @__PURE__ */React.createElement("p", null, category(selected), " \xB7 ", selected.month, " ", selected.year, " \xB7 ", selected.state === "recorded" ? "Recorded" : "Planned", selected.transactionDate ? " \xB7 " + when(selected.transactionDate) : ""), selected.state !== "recorded" && /* @__PURE__ */React.createElement("p", null, "Planned entries do not reduce tracked principal until recorded with a valid breakdown.")) : /* @__PURE__ */React.createElement("p", null, link.recordId ? "The connected expense is unavailable. Reload its workbook before editing." : "Choose a result above before entering the payment breakdown."), editing && /* @__PURE__ */React.createElement("small", null, "This connection\u2019s expense is fixed. Unlink it first if you need to connect a different entry.")));
}
function DebtTrackers({
  state,
  books,
  packets,
  errors,
  activeId,
  onSave,
  onReload,
  onOpen,
  api,
  onDirty,
  workspaceYear = (/* @__PURE__ */new Date()).getFullYear(),
  workspaceMonth = (/* @__PURE__ */new Date()).getMonth(),
  allowBusiness = true
}) {
  const loans = state?.loans || [],
    loan = loans.find(l => l.id === activeId),
    [draft, setDraft] = useState(activeId === "new" ? blank() : null),
    [link, setLink] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [y, setY] = useState((/* @__PURE__ */new Date()).getFullYear()),
    [m, setM] = useState((/* @__PURE__ */new Date()).getMonth()),
    [plannedType, setPlannedType] = useState("regular"),
    [paymentYear, setPaymentYear] = useState("all"),
    [paymentMonth, setPaymentMonth] = useState("all");
  useEffect(() => {
    onDirty(!!draft || !!link || busy);
    return () => onDirty(false);
  }, [!!draft, !!link, busy]);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function put(next) {
    await onSave(next);
  }
  const allEntries = books.flatMap(b => b.records.filter(r => r.kind === "expense" && r.scope === (loan?.area === "business" ? "business" : "residence")).map(r => ({
      ...r,
      year: b.year
    }))),
    used = new Set(loans.flatMap(l => l.links.map(p => p.year + ":" + p.recordId))),
    eligible = allEntries.filter(r => !used.has(r.year + ":" + r.id) || link && r.id === link.recordId && r.year === link.year),
    s = loan ? debtSummary(loan, books, localDate()) : null;
  async function createExpense() {
    if (!loan) return;
    const packet = packets.find(p => p.year === Number(y)),
      book = books.find(b => b.year === Number(y));
    if (!packet || !book) throw Error("Link and load the selected annual workbook first.");
    const extra = plannedType === "extra",
      expenseName = loan.name + (extra ? " \xB7 Extra principal" : ""),
      id = "debt-" + loan.id + "-" + y + "-" + m + (extra ? "-extra" : "");
    const existing = book.records.find(r => r.id === id);
    if (existing) {
      setMessage("A planned expense for this loan/month already exists. Use Connect expense below.");
      return;
    }
    const next = structuredClone(book);
    let category, def;
    if (loan.area === "personal") {
      category = next.categories.find(c => c.role === "residence")?.name || "Residence";
      def = next.householdCategories.find(c => c.name === expenseName);
      if (!def) {
        def = {
          id: "debtcat-" + loan.id + (extra ? "-extra" : ""),
          name: expenseName,
          months: [...months],
          subs: []
        };
        next.householdCategories.push(def);
      }
      if (!def.months.includes(months[m])) def.months.push(months[m]);
    } else {
      category = expenseName;
      const existingCategory = next.categories.find(c => c.name === category);
      if (extra && existingCategory && existingCategory.role !== "variable") throw Error("An existing category with this extra-principal name is not Variable. Rename it before creating this expense.");
      if (!existingCategory) next.categories.push({
        name: category,
        role: "variable",
        subs: []
      });
    }
    next.records.push({
      id,
      month: months[m],
      sheet: months[m],
      isNew: true,
      kind: "expense",
      scope: loan.area === "business" ? "business" : "residence",
      category,
      subCategory: def?.name || "",
      householdCategoryId: def?.id || "",
      householdSubId: "",
      description: expenseName + " payment",
      amount: null,
      miles: null,
      location: "",
      state: "planned",
      percent: null,
      recurringType: extra ? "variable" : "fixed",
      transactionDate: ""
    });
    await api("save", {
      year: Number(y),
      workbookPath: packet.path,
      revision: packet.revision,
      base64: writeBook(packet.base64, next)
    });
    await onReload();
    setMessage("Planned expense created with a blank amount. Record the actual payment in its monthly workspace, then connect it here. No payment has been counted yet.");
  }
  function input(key, label, type = "text", opts = {}) {
    return /* @__PURE__ */React.createElement("label", null, label, /* @__PURE__ */React.createElement("input", {
      type,
      value: draft[key] ?? "",
      ...opts,
      onChange: e => setDraft({
        ...draft,
        [key]: type === "number" ? e.target.value === "" ? null : Number(e.target.value) : e.target.value
      })
    }));
  }
  return /* @__PURE__ */React.createElement("section", {
    className: "panel debt-workspace"
  }, /* @__PURE__ */React.createElement("div", {
    className: "panel-heading"
  }, (!loan || draft) && /* @__PURE__ */React.createElement("h2", null, draft ? "Loan details" : "Loan trackers"), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!draft || !!link,
    onClick: () => run(onReload)
  }, "Reload Trackers & Expenses")), error && /* @__PURE__ */React.createElement("p", {
    className: "error",
    role: "alert"
  }, error), message && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, message), errors.map(e => /* @__PURE__ */React.createElement("p", {
    className: "error",
    key: e.year
  }, e.year, ": ", e.error, ". Linked payments may be unavailable.")), draft ? /* @__PURE__ */React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      run(async () => {
        const next = {
          ...draft
        };
        if (next.mode === "original") {
          if (!next.originationDate) throw Error("Enter the origination date when tracking from the original amount.");
          next.balance = next.original;
          next.asOf = next.originationDate;
        }
        await put(loans.some(l => l.id === next.id) ? loans.map(l => l.id === next.id ? next : l) : [...loans, next]);
        setDraft(null);
        onOpen("debt_" + next.id);
      });
    }
  }, /* @__PURE__ */React.createElement("fieldset", {
    disabled: busy
  }, /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, input("name", "Loan name", "text", {
    required: true,
    maxLength: 150
  }), input("lender", "Lender"), /* @__PURE__ */React.createElement("label", null, "Area", /* @__PURE__ */React.createElement("select", {
    value: draft.area,
    onChange: e => setDraft({
      ...draft,
      area: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: "personal"
  }, "Personal"), allowBusiness && /* @__PURE__ */React.createElement("option", {
    value: "business"
  }, "Business"))), /* @__PURE__ */React.createElement("label", null, "Starting point", /* @__PURE__ */React.createElement("select", {
    value: draft.mode,
    onChange: e => setDraft({
      ...draft,
      mode: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: "current"
  }, "Current statement balance"), /* @__PURE__ */React.createElement("option", {
    value: "original"
  }, "Original loan amount"))), input("originationDate", "Loan origination date", "date", {
    required: draft.mode === "original",
    max: localDate()
  }), input("originalTerm", "Original loan term (months, optional)", "number", {
    min: 1,
    max: 600
  }), input("maturityDate", "Scheduled maturity date (optional)", "date"), input("original", "Original principal ($)", "number", {
    min: 0.01,
    step: 0.01,
    required: true
  }), draft.mode === "current" && input("balance", "Confirmed principal balance ($)", "number", {
    min: 0,
    step: 0.01,
    required: true
  }), draft.mode === "current" ? input("asOf", "Principal balance as-of date", "date", {
    required: true,
    max: localDate()
  }) : /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Tracking starts at the original principal on the origination date above."), input("rate", "Annual interest rate (%)", "number", {
    min: 0,
    max: 100,
    step: 1e-3,
    required: true
  }), input("term", "Remaining term for estimate (months)", "number", {
    min: 1,
    max: 600,
    required: true
  }), input("payment", "Scheduled principal + interest payment ($)", "number", {
    min: 0,
    step: 0.01,
    required: true
  }), input("plannedExtraPrincipal", "Planned extra principal per month ($, optional)", "number", {
    min: 0,
    step: 0.01
  }), input("dueDay", "Usual due day (1\u201328)", "number", {
    min: 1,
    max: 28,
    required: true
  }), input("nextDue", "Next payment due date", "date", {
    required: true
  }), input("payoffQuote", "Lender payoff quote ($, optional)", "number", {
    min: 0,
    step: 0.01
  }), input("payoffQuoteDate", "Payoff quote as-of date (optional)", "date"), input("paidOff", "Actually paid in full on (optional)", "date", {
    max: localDate()
  })), /* @__PURE__ */React.createElement("label", null, "Notes", /* @__PURE__ */React.createElement("textarea", {
    maxLength: 5e3,
    value: draft.note,
    onChange: e => setDraft({
      ...draft,
      note: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Opening/statement balance already includes payments through its as-of date. Only later verified principal reduces the tracked balance. Enter a new statement balance/date here to reconcile. Origination and maturity describe the loan contract. The principal balance/date anchors actual tracking. The optional lender payoff quote/date is displayed separately and never changes principal or marks the loan paid. Leave Actually paid in full on blank until repayment is complete. To mark Paid off, use Current statement balance, confirm $0 principal and enter the actual completion date. Next due date is maintained manually."), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Save Loan"), " ", /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => {
      setDraft(null);
      if (activeId === "new") onOpen("debts");
    }
  }, "Cancel"))) : loan ? /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "overview-grid"
  }, /* @__PURE__ */React.createElement(DebtCards, {
    loans: [{
      ...loan,
      archived: false
    }],
    books,
    onOpen
  }), /* @__PURE__ */React.createElement("article", {
    className: "overview-card"
  }, /* @__PURE__ */React.createElement("h3", null, "Loan particulars"), /* @__PURE__ */React.createElement("p", null, loan.lender || "Lender not entered", " \xB7 ", loan.area), /* @__PURE__ */React.createElement("p", null, "Original principal ", cash(loan.original), " \xB7 ", loan.rate, "% annual rate \xB7 ", loan.term, " months for estimate"), /* @__PURE__ */React.createElement("p", null, "Originated: ", loan.originationDate ? when(loan.originationDate) : loan.mode === "original" ? when(loan.asOf) : "Not entered", " \xB7 Original term: ", loan.originalTerm ? loan.originalTerm + " months" : "Not entered"), /* @__PURE__ */React.createElement("p", null, "Scheduled maturity: ", loan.maturityDate ? when(loan.maturityDate) : "Not entered"), /* @__PURE__ */React.createElement("p", null, "Planned extra principal per month: ", cash(loan.plannedExtraPrincipal || 0), " \xB7 estimate only; actual extra payments are entered separately."), /* @__PURE__ */React.createElement("p", null, "Due day ", loan.dueDay, " \xB7 ", loan.note), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!link,
    onClick: () => setDraft(editableLoan(loan))
  }, "Edit Details / Reconcile Balance"), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!link,
    onClick: () => run(() => put(loans.map(l => l.id === loan.id ? {
      ...l,
      archived: !l.archived
    } : l)))
  }, loan.archived ? "Restore To Overview" : "Archive Tracker"), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!link,
    onClick: () => {
      if (confirm("Remove this tracker and its payment breakdowns? Expense entries remain. A tracker backup is made first.")) run(async () => {
        await put(loans.filter(l => l.id !== loan.id));
        onOpen("debts");
      });
    }
  }, "Remove Tracker"))), /* @__PURE__ */React.createElement("section", null, /* @__PURE__ */React.createElement("h3", null, "Actual payments"), /* @__PURE__ */React.createElement("p", null, "Statement history comes from connected expenses and the lender\u2019s breakdown you enter. The estimate below does not populate or replace these amounts."), /* @__PURE__ */React.createElement("p", null, "Connect each actual payment once. Editing its amount in the expense workbook is reflected here after Reload; an inconsistent breakdown is flagged. Connections never add income or spending."), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!link,
    onClick: () => setLink({
      year: 0,
      recordId: "",
      date: "",
      paymentType: "regular",
      principal: null,
      interest: null,
      escrow: null,
      fees: null
    })
  }, "Connect Existing Expense"), /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Create a new planned expense"), /* @__PURE__ */React.createElement("p", null, "Creates a category named after this loan if needed, and one blank planned entry for the selected month. Then record its actual payment in Business or Personal and connect it here."), /* @__PURE__ */React.createElement("label", null, "Planned expense type", /* @__PURE__ */React.createElement("select", {
    value: plannedType,
    onChange: e => setPlannedType(e.target.value)
  }, /* @__PURE__ */React.createElement("option", {
    value: "regular"
  }, "Regular payment"), /* @__PURE__ */React.createElement("option", {
    value: "extra"
  }, "Separate extra principal \xB7 variable expense"))), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Extra principal creates a separate variable category and blank planned entry. The monthly extra-principal plan affects estimates only; it is never recorded as money paid."), /* @__PURE__ */React.createElement("label", null, "Expense year", /* @__PURE__ */React.createElement("select", {
    value: y,
    onChange: e => setY(+e.target.value)
  }, /* @__PURE__ */React.createElement("option", {
    value: y
  }, y), books.filter(b => b.year !== y).map(b => /* @__PURE__ */React.createElement("option", {
    key: b.year
  }, b.year)))), /* @__PURE__ */React.createElement("label", null, "Expense month", /* @__PURE__ */React.createElement("select", {
    value: m,
    onChange: e => setM(+e.target.value)
  }, months.map((n, i) => /* @__PURE__ */React.createElement("option", {
    value: i,
    key: n
  }, n)))), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!link,
    onClick: () => run(createExpense)
  }, "Create Planned Expense")), link && /* @__PURE__ */React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      run(async () => {
        const r = allEntries.find(r2 => r2.id === link.recordId && r2.year === link.year);
        if (loans.some(l => l.id !== loan.id && l.links.some(p => p.year === link.year && p.recordId === link.recordId))) throw Error("This expense is already connected to another loan.");
        if (!r) throw Error("Choose an expense.");
        if (months.indexOf(r.month) !== Number(link.date.slice(5, 7)) - 1 || Number(link.date.slice(0, 4)) !== r.year) throw Error("Payment date must be in the expense month/year.");
        const next = {
          ...loan,
          links: [...loan.links.filter(p => p.recordId !== link.recordId || p.year !== link.year), link]
        };
        await put(loans.map(l => l.id === loan.id ? next : l));
        const check = linkedPayment(loan, link, books);
        setMessage(check.issue || check.breakdownIssue ? "Connection saved \u2014 needs attention: " + (check.issue || check.breakdownIssue) : "Connection saved \u2014 breakdown matches the expense." + (link.date <= loan.asOf ? " This payment is already included in the confirmed balance." : ""));
        setLink(null);
      });
    }
  }, /* @__PURE__ */React.createElement("fieldset", {
    disabled: busy
  }, /* @__PURE__ */React.createElement(ExpensePicker, {
    entries: allEntries,
    loans,
    link,
    initialYear: workspaceYear,
    initialMonth: workspaceMonth,
    editing: loan.links.some(p => p.recordId === link.recordId && p.year === link.year),
    onSelect: r => {
      if (r.id === link.recordId && r.year === link.year) return;
      if (["principal", "interest", "escrow", "fees"].some(k => link[k] != null) && !confirm("Change the selected expense and clear the entered payment breakdown?")) return;
      setLink({
        ...link,
        recordId: r.id,
        year: r.year,
        date: r.transactionDate || "",
        principal: null,
        interest: null,
        escrow: null,
        fees: null
      });
    }
  }), /* @__PURE__ */React.createElement("label", null, "Payment purpose", /* @__PURE__ */React.createElement("select", {
    value: link.paymentType || "regular",
    onChange: e => setLink({
      ...link,
      paymentType: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: "regular"
  }, "Regular payment"), /* @__PURE__ */React.createElement("option", {
    value: "extra"
  }, "Separate extra principal only"))), /* @__PURE__ */React.createElement("label", null, "Actual payment date", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "date",
    value: link.date,
    onChange: e => setLink({
      ...link,
      date: e.target.value
    })
  })), /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, ["principal", "interest", "escrow", "fees"].map(k => /* @__PURE__ */React.createElement("label", {
    key: k
  }, k, /* @__PURE__ */React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    value: link[k] ?? "",
    onChange: e => setLink({
      ...link,
      [k]: e.target.value === "" ? null : Number(e.target.value)
    })
  })))), /* @__PURE__ */React.createElement("p", {
    className: "notice",
    role: "status",
    "aria-live": "polite"
  }, (() => {
    const r = allEntries.find(r2 => r2.id === link.recordId && r2.year === link.year);
    return !r ? "Choose an expense to check its breakdown." : breakdownMessage(link, r.amount) || "Breakdown matches the expense: " + cash(r.amount) + ".";
  })()), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Enter the lender's actual breakdown, including explicit zeros. Components must equal the expense amount before principal can reduce the tracked balance. Leave unknown components blank; they remain flagged."), /* @__PURE__ */React.createElement("button", {
    disabled: !link.recordId
  }, "Save Connection"), " ", /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => setLink(null)
  }, "Cancel"))), s.payments.length === 0 && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "No actual payments connected yet. Your confirmed principal balance is still used; historical payments are not reconstructed automatically."), /* @__PURE__ */React.createElement("div", {
    className: "year-tabs",
    "aria-label": "Loan payment year"
  }, /* @__PURE__ */React.createElement("button", {
    onClick: () => {
      setPaymentYear("all");
      setPaymentMonth("all");
    },
    className: paymentYear === "all" ? "selected" : ""
  }, "All Years"), [...new Set(s.payments.map(p => p.year))].sort().map(y2 => /* @__PURE__ */React.createElement("button", {
    key: y2,
    className: paymentYear === y2 ? "selected" : "",
    onClick: () => {
      setPaymentYear(y2);
      setPaymentMonth("all");
    }
  }, y2))), paymentYear !== "all" && /* @__PURE__ */React.createElement("div", {
    className: "month-tabs",
    "aria-label": "Loan payment month"
  }, /* @__PURE__ */React.createElement("button", {
    onClick: () => setPaymentMonth("all")
  }, "All Months"), months.map((m2, i) => /* @__PURE__ */React.createElement("button", {
    key: m2,
    className: paymentMonth === i ? "selected" : "",
    onClick: () => setPaymentMonth(i)
  }, m2))), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Payments shown: ", paymentYear === "all" ? "all years" : paymentYear, " \xB7 ", paymentMonth === "all" ? "all months" : months[paymentMonth], ". Balance above always uses the full tracking history."), /* @__PURE__ */React.createElement("div", {
    className: "table-wrap"
  }, /* @__PURE__ */React.createElement("table", null, /* @__PURE__ */React.createElement("thead", null, /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Date / expense"), /* @__PURE__ */React.createElement("th", null, "Amount"), /* @__PURE__ */React.createElement("th", null, "Principal / interest / escrow / fees"), /* @__PURE__ */React.createElement("th", null, "Status"), /* @__PURE__ */React.createElement("th", null, "Actions"))), /* @__PURE__ */React.createElement("tbody", null, s.payments.filter(p => (paymentYear === "all" || p.year === paymentYear) && (paymentMonth === "all" || Number(p.date.slice(5, 7)) - 1 === paymentMonth)).sort((a, b) => a.date.localeCompare(b.date)).map(p => /* @__PURE__ */React.createElement("tr", {
    key: p.year + ":" + p.recordId
  }, /* @__PURE__ */React.createElement("td", null, when(p.date), /* @__PURE__ */React.createElement("br", null), /* @__PURE__ */React.createElement("small", null, p.paymentType === "extra" ? "Extra principal only" : "Regular payment"), /* @__PURE__ */React.createElement("br", null), p.record?.description || p.recordId), /* @__PURE__ */React.createElement("td", null, p.amount === null ? "Unknown" : cash(p.amount)), /* @__PURE__ */React.createElement("td", null, ["principal", "interest", "escrow", "fees"].map(k => p[k] === null ? "?" : cash(p[k])).join(" / ")), /* @__PURE__ */React.createElement("td", null, p.issue || (!p.complete ? p.breakdownIssue : p.date <= loan.asOf ? "Included in opening/statement balance" : "Verified breakdown")), /* @__PURE__ */React.createElement("td", null, /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!link,
    onClick: () => setLink({
      ...loan.links.find(l => l.recordId === p.recordId && l.year === p.year)
    })
  }, "Edit Breakdown"), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !!link,
    onClick: () => run(() => put(loans.map(l => l.id === loan.id ? {
      ...l,
      links: l.links.filter(x => x.year !== p.year || x.recordId !== p.recordId)
    } : l)))
  }, "Unlink")))))))), /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Estimated future payments"), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, "Starting principal: ", cash(loan.balance), " as of ", when(loan.asOf), "."), " This illustration starts after that balance date; it does not recreate earlier payments."), /* @__PURE__ */React.createElement("p", null, "Projected dates use due day ", loan.dueDay, ", beginning with its first occurrence after the balance date. They are independent of the manually maintained Next payment due date. Rows that have since passed remain estimates; reconcile the balance/date and remaining term to restart from a newer statement."), /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "Estimated interest = opening principal for each row \xD7 ", loan.rate, "% \xF7 12. These figures may differ from your lender\u2019s actual breakdown. Payment timing, daily interest, rounding and other lender rules are not modeled. Even a partial first month uses one full estimated month. Enter the statement\u2019s actual breakdown under Actual payments above."), /* @__PURE__ */React.createElement("p", null, "Planned extra principal: ", cash(loan.plannedExtraPrincipal || 0), " per month, applied after the regular payment in this illustration. The actual separate transaction date may produce a different lender result. Planned extra amounts do not create expenses or reduce tracked principal."), /* @__PURE__ */React.createElement("p", null, "Excludes escrow, fees and future rate changes. This is not a lender payoff quote. Connected payments affect tracked principal above, but do not change this illustration\u2019s confirmed starting balance."), (() => {
    const e = estimate(loan);
    return /* @__PURE__ */React.createElement(React.Fragment, null, e.error && /* @__PURE__ */React.createElement("p", null, e.error), e.remaining > 0 && /* @__PURE__ */React.createElement("p", null, cash(e.remaining), " remains after the entered term at this estimated payment."), /* @__PURE__ */React.createElement("div", {
      className: "table-wrap"
    }, /* @__PURE__ */React.createElement("table", null, /* @__PURE__ */React.createElement("thead", null, /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Projected payment date"), /* @__PURE__ */React.createElement("th", null, "Regular payment"), /* @__PURE__ */React.createElement("th", null, "Planned extra principal"), /* @__PURE__ */React.createElement("th", null, "Estimated total payment"), /* @__PURE__ */React.createElement("th", null, "Estimated interest"), /* @__PURE__ */React.createElement("th", null, "Estimated principal"), /* @__PURE__ */React.createElement("th", null, "Estimated balance"))), /* @__PURE__ */React.createElement("tbody", null, e.rows.map(r => /* @__PURE__ */React.createElement("tr", {
      key: r.month
    }, /* @__PURE__ */React.createElement("td", null, when(r.date)), /* @__PURE__ */React.createElement("td", null, cash(r.regularPayment)), /* @__PURE__ */React.createElement("td", null, cash(r.extraPrincipal)), /* @__PURE__ */React.createElement("td", null, cash(r.payment)), /* @__PURE__ */React.createElement("td", null, cash(r.interest)), /* @__PURE__ */React.createElement("td", null, cash(r.principal)), /* @__PURE__ */React.createElement("td", null, cash(r.balance))))))));
  })())) : /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: () => setDraft(blank())
  }, "Add Loan Tracker"), /* @__PURE__ */React.createElement("p", null, "Archived loans remain here and can be restored to the overview. Removing a tracker never deletes its expense entries."), loans.map(l => /* @__PURE__ */React.createElement("p", {
    key: l.id
  }, /* @__PURE__ */React.createElement("button", {
    onClick: () => onOpen("debt_" + l.id)
  }, l.name), " \xB7 ", l.archived ? "Archived" : l.paidOff ? "Paid off" : "Active"))));
}
export { DebtCards, DebtTrackers as default };
